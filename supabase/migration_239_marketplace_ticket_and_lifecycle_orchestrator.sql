-- NAXA 239 — ticket de caisse client authentifié et ordonnancement unifié du cycle de réservation.
-- Migration additive. À appliquer et tester d'abord sur une base hors production.

begin;

-- Le client peut relire le ticket exact de sa vente Marketplace, mais jamais un ticket
-- obtenu uniquement à partir d'un identifiant fourni sans contrôle de propriété.
create or replace function public.get_client_reservation_ticket(p_reservation_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_res public.reservations%rowtype;
  v_sale public.ventes%rowtype;
  v_items jsonb;
  v_payments jsonb;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if p_reservation_id is null then
    raise exception 'Référence de réservation requise';
  end if;

  select r.* into v_res
  from public.reservations r
  where r.id = p_reservation_id
    and r.client_id = auth.uid();

  if not found then
    raise exception 'Réservation introuvable ou accès refusé';
  end if;
  if v_res.statut::text not in ('payee', 'retiree')
     or v_res.paiement_statut::text not in ('effectue', 'payee') then
    raise exception 'Le ticket est disponible après confirmation du paiement en caisse';
  end if;

  select v.* into v_sale
  from public.ventes v
  where v.reservation_id = v_res.id
    and v.client_id = auth.uid()
    and v.pharmacie_id = v_res.pharmacie_id
    and v.statut::text = 'payee'
  for share;

  if not found then
    raise exception 'Aucun ticket de caisse payé n’est lié à cette réservation';
  end if;
  if v_res.paiement_ticket_numero is not null
     and v_res.paiement_ticket_numero is distinct from v_sale.numero_vente then
    raise exception 'Incohérence entre le ticket POS et le reçu de réservation';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'produit_id', vl.produit_id,
    'produit_nom', coalesce(p.nom, 'Article'),
    'produit_dosage', p.dosage,
    'quantite', vl.quantite,
    'prix_unitaire', vl.prix_unitaire,
    'total_ligne', vl.total_ligne
  ) order by vl.id), '[]'::jsonb)
  into v_items
  from public.vente_lignes vl
  left join public.produits p on p.id = vl.produit_id
  where vl.vente_id = v_sale.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'mode', vp.mode::text,
    'montant', vp.montant,
    'montant_percu', vp.montant_percu,
    'monnaie_rendue', vp.monnaie_rendue,
    'created_at', vp.created_at
  ) order by vp.created_at), '[]'::jsonb)
  into v_payments
  from public.vente_paiements vp
  where vp.vente_id = v_sale.id;

  if jsonb_array_length(v_items) = 0 then
    raise exception 'Le ticket POS ne contient aucune ligne';
  end if;
  if jsonb_array_length(v_payments) = 0 then
    raise exception 'Le ticket POS ne contient aucune écriture de paiement';
  end if;

  return jsonb_build_object(
    'receipt_type', 'cashier_ticket',
    'sale', jsonb_build_object(
      'vente_id', v_sale.id,
      'numero_vente', v_sale.numero_vente,
      'pharmacie_id', v_sale.pharmacie_id,
      'statut', v_sale.statut::text,
      'created_at', v_sale.created_at,
      'paid_at', v_sale.paid_at,
      'total_brut', v_sale.total_brut,
      'remise', v_sale.remise,
      'total_net', v_sale.total_net,
      'mode_paiement', v_sale.mode_paiement::text,
      'paiement_ref', v_sale.paiement_ref
    ),
    'items', v_items,
    'payments', v_payments,
    'reservation', jsonb_build_object(
      'reservation_id', v_res.id,
      'ticket_numero_snapshot', v_res.paiement_ticket_numero,
      'montant_percu_snapshot', v_res.paiement_montant_percu,
      'monnaie_rendue_snapshot', v_res.paiement_monnaie_rendue,
      'paiement_valide_at', v_res.paiement_valide_at
    )
  );
end;
$function$;

revoke all on function public.get_client_reservation_ticket(uuid) from public, anon;
grant execute on function public.get_client_reservation_ticket(uuid) to authenticated;
comment on function public.get_client_reservation_ticket(uuid) is
  'Retourne le ticket POS serveur lié à une réservation payée, uniquement au client propriétaire. Ne reconstruit pas le ticket depuis client_achats.';

-- Une seule routine orchestre expiration/restauration puis rappel à 30 minutes.
-- Chaque étape est isolée pour qu'une panne de l'une ne masque pas l'autre.
create or replace function public.reservation_lifecycle_cron()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_expiry jsonb := '{}'::jsonb;
  v_notifications integer := 0;
  v_errors jsonb := '[]'::jsonb;
begin
  begin
    v_expiry := public.expirer_reservations_cron(p_limit := 500);
  exception when others then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'step', 'expiration_stock_restore', 'error', left(sqlerrm, 300)
    ));
  end;

  begin
    v_notifications := public.notifier_reservations_expirant_30m();
  exception when others then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'step', 'notification_30m', 'error', left(sqlerrm, 300)
    ));
  end;

  return jsonb_build_object(
    'ok', jsonb_array_length(v_errors) = 0,
    'expiration', v_expiry,
    'notificationsCreated', v_notifications,
    'errors', v_errors,
    'at', now()
  );
end;
$function$;

revoke all on function public.reservation_lifecycle_cron() from public, anon, authenticated;
grant execute on function public.reservation_lifecycle_cron() to service_role;
comment on function public.reservation_lifecycle_cron() is
  'Routine serveur unique : expiration/restauration idempotente et notification à 30 minutes; renvoie les erreurs par étape pour la supervision.';

-- Élimine uniquement les anciens jobs NAXA connus, puis installe un seul job.
-- Si pg_cron n'est pas disponible, l'endpoint sécurisé appelle la même routine.
do $schedule$
declare
  v_job record;
begin
  if exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') then
    for v_job in
      select jobid
      from cron.job
      where jobname in (
        'naxa-reservation-expiry-release',
        'naxa-reservation-expire-stock-restore',
        'naxa-reservation-expiry-30m',
        'naxa-reservation-lifecycle'
      )
    loop
      perform cron.unschedule(v_job.jobid);
    end loop;

    perform cron.schedule(
      'naxa-reservation-lifecycle',
      '*/5 * * * *',
      'select public.reservation_lifecycle_cron();'
    );
  else
    raise notice 'pg_cron absent : configurer un ordonnanceur externe sur /api/cron/reservation-expiry avec CRON_SECRET.';
  end if;
exception
  when undefined_table or insufficient_privilege or feature_not_supported then
    raise notice 'pg_cron indisponible : configurer un ordonnanceur externe sur /api/cron/reservation-expiry avec CRON_SECRET.';
end;
$schedule$;

commit;
