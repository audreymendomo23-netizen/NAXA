-- NAXA 239 — ticket de caisse client authentifié et ordonnancement unifié du cycle de réservation.
-- Migration additive. À appliquer et tester d'abord sur une base hors production.

begin;

-- Preview bootstrap: this migration declares public.ventes and public.vente_paiements rowtypes.
-- Restore the POS table contract here, before compiling the Marketplace ticket RPC.
-- NAXA Preview: schema prerequisites for the POS/Assurance migrations.
-- The canonical POS table migrations still live in supabase/migration_*.sql,
-- outside the directory replayed by Supabase Preview. This migration restores
-- their required table shape only; it does not copy legacy RPCs or seed data.
-- RLS is enabled and direct writes stay closed; controlled server RPCs own mutations.

do $$
begin
  create type public.vente_statut as enum ('brouillon', 'payee', 'annulee');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.mode_paiement_caisse as enum ('especes', 'mobile_money', 'carte', 'autre');
exception when duplicate_object then null;
end
$$;

alter type public.mode_paiement_caisse add value if not exists 'orange_money';
alter type public.mode_paiement_caisse add value if not exists 'mtn_momo';

do $$
begin
  create type public.caisse_cloture_statut as enum ('ouverte', 'cloturee');
exception when duplicate_object then null;
end
$$;

create sequence if not exists public.vente_numero_seq
  as bigint start with 1 increment by 1 minvalue 1 no cycle;

create table if not exists public.stocks_lots (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  produit_id uuid not null references public.produits(id) on delete cascade,
  numero_lot text not null,
  date_peremption date not null,
  quantite integer not null default 0 check (quantite >= 0),
  bloque boolean not null default false,
  motif_blocage text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pharmacie_id, produit_id, numero_lot),
  check (not bloque or motif_blocage is not null)
);

create index if not exists stocks_lots_peremption_idx
  on public.stocks_lots(pharmacie_id, date_peremption);
create index if not exists stocks_lots_produit_idx
  on public.stocks_lots(produit_id);

create table if not exists public.caisses (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  nom text not null default 'Caisse principale',
  actif boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists caisses_pharmacie_nom_uq
  on public.caisses(pharmacie_id, lower(nom));

create table if not exists public.caisses_sessions (
  id uuid primary key default gen_random_uuid(),
  caisse_id uuid not null references public.caisses(id) on delete cascade,
  ouvert_par uuid not null references auth.users(id),
  ouvert_at timestamptz not null default now(),
  fond_initial integer not null default 0 check (fond_initial >= 0),
  statut public.caisse_cloture_statut not null default 'ouverte',
  cloture_at timestamptz,
  cloture_par uuid references auth.users(id),
  total_theorique integer not null default 0,
  total_compte integer,
  ecart integer,
  unique (caisse_id) deferrable initially immediate
);

create table if not exists public.ventes (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id),
  caisse_session_id uuid not null references public.caisses_sessions(id),
  client_id uuid references auth.users(id),
  statut public.vente_statut not null default 'brouillon',
  remise integer not null default 0 check (remise >= 0),
  total_brut integer not null default 0 check (total_brut >= 0),
  total_net integer not null default 0 check (total_net >= 0),
  mode_paiement public.mode_paiement_caisse,
  paiement_ref text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  numero_vente text not null default (
    'V-' || to_char(current_timestamp, 'YYYYMMDD') || '-' ||
    lpad(nextval('public.vente_numero_seq')::text, 6, '0')
  ),
  reservation_id uuid references public.reservations(id) on delete restrict,
  stock_decremented_at_draft boolean not null default true
);
create unique index if not exists ventes_numero_vente_uq
  on public.ventes(numero_vente);
create unique index if not exists ventes_reservation_id_uq
  on public.ventes(reservation_id) where reservation_id is not null;
create index if not exists ventes_pharmacie_date_idx
  on public.ventes(pharmacie_id, created_at);
create index if not exists ventes_session_idx
  on public.ventes(caisse_session_id);

create table if not exists public.vente_lignes (
  id uuid primary key default gen_random_uuid(),
  vente_id uuid not null references public.ventes(id) on delete cascade,
  produit_id uuid not null references public.produits(id),
  lot_id uuid references public.stocks_lots(id) on delete restrict,
  quantite integer not null check (quantite > 0),
  prix_unitaire integer not null check (prix_unitaire >= 0),
  total_ligne integer generated always as (quantite * prix_unitaire) stored
);
create index if not exists vente_lignes_produit_idx
  on public.vente_lignes(produit_id);
create index if not exists vente_lignes_lot_idx
  on public.vente_lignes(lot_id);

create table if not exists public.vente_paiements (
  id uuid primary key default gen_random_uuid(),
  vente_id uuid not null references public.ventes(id) on delete cascade,
  mode public.mode_paiement_caisse not null,
  montant integer not null check (montant > 0),
  reference text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  montant_percu integer,
  monnaie_rendue integer
);
create index if not exists vente_paiements_vente_idx
  on public.vente_paiements(vente_id);
create index if not exists vente_paiements_mode_date_idx
  on public.vente_paiements(mode, created_at desc);

alter table public.stocks_lots enable row level security;
alter table public.caisses enable row level security;
alter table public.caisses_sessions enable row level security;
alter table public.ventes enable row level security;
alter table public.vente_lignes enable row level security;
alter table public.vente_paiements enable row level security;

drop policy if exists stocks_lots_lecture on public.stocks_lots;
create policy stocks_lots_lecture on public.stocks_lots
  for select to authenticated
  using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

drop policy if exists stocks_lots_equipe_insert on public.stocks_lots;
create policy stocks_lots_equipe_insert on public.stocks_lots
  for insert to authenticated
  with check (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

drop policy if exists stocks_lots_equipe_update on public.stocks_lots;
create policy stocks_lots_equipe_update on public.stocks_lots
  for update to authenticated
  using (public.is_admin() or public.can_access_pharmacy(pharmacie_id))
  with check (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

drop policy if exists stocks_lots_equipe_delete on public.stocks_lots;
create policy stocks_lots_equipe_delete on public.stocks_lots
  for delete to authenticated
  using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

drop policy if exists caisses_scope on public.caisses;
create policy caisses_scope on public.caisses
  for select to authenticated
  using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

drop policy if exists caisses_sessions_scope on public.caisses_sessions;
create policy caisses_sessions_scope on public.caisses_sessions
  for select to authenticated
  using (
    exists (
      select 1 from public.caisses c
      where c.id=caisses_sessions.caisse_id
        and (public.is_admin() or public.can_access_pharmacy(c.pharmacie_id))
    )
  );

drop policy if exists ventes_scope on public.ventes;
create policy ventes_scope on public.ventes
  for select to authenticated
  using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

drop policy if exists vente_lignes_scope on public.vente_lignes;
create policy vente_lignes_scope on public.vente_lignes
  for select to authenticated
  using (
    exists (
      select 1 from public.ventes v
      where v.id=vente_lignes.vente_id
        and (public.is_admin() or public.can_access_pharmacy(v.pharmacie_id))
    )
  );

drop policy if exists vente_paiements_scope on public.vente_paiements;
create policy vente_paiements_scope on public.vente_paiements
  for select to authenticated
  using (
    exists (
      select 1 from public.ventes v
      where v.id=vente_paiements.vente_id
        and (public.is_admin() or public.can_access_pharmacy(v.pharmacie_id))
    )
  );

revoke all on public.stocks_lots from anon, authenticated;
revoke all on public.caisses from anon, authenticated;
revoke all on public.caisses_sessions from anon, authenticated;
revoke all on public.ventes from anon, authenticated;
revoke all on public.vente_lignes from anon, authenticated;
revoke all on public.vente_paiements from anon, authenticated;
grant select on public.stocks_lots to authenticated;
grant select on public.caisses to authenticated;
grant select on public.caisses_sessions to authenticated;
grant select on public.ventes to authenticated;
grant select on public.vente_lignes to authenticated;
grant select on public.vente_paiements to authenticated;



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
  v_last_payment public.vente_paiements%rowtype;
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
  if coalesce(v_res.statut::text, '') not in ('payee', 'retiree')
     or coalesce(v_res.paiement_statut::text, '') not in ('effectue', 'payee') then
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

  select vp.* into v_last_payment
  from public.vente_paiements vp
  where vp.vente_id = v_sale.id
  order by vp.created_at desc
  limit 1;

  if jsonb_array_length(v_items) = 0 then
    raise exception 'Le ticket POS ne contient aucune ligne';
  end if;
  if jsonb_array_length(v_payments) = 0 or not found then
    raise exception 'Le ticket POS ne contient aucune écriture de paiement';
  end if;
  if v_sale.total_net is distinct from v_res.total then
    raise exception 'Le total du ticket POS ne correspond pas au total de la réservation';
  end if;
  if coalesce((select sum(vl.total_ligne)::integer from public.vente_lignes vl where vl.vente_id = v_sale.id), 0)
       is distinct from v_sale.total_brut then
    raise exception 'Les lignes du ticket POS ne correspondent pas au total brut';
  end if;
  if v_res.paiement_montant_percu is not null
     and v_res.paiement_montant_percu is distinct from v_last_payment.montant_percu then
    raise exception 'Le montant reçu du snapshot ne correspond pas à l’écriture POS';
  end if;
  if v_res.paiement_monnaie_rendue is not null
     and v_res.paiement_monnaie_rendue is distinct from v_last_payment.monnaie_rendue then
    raise exception 'La monnaie rendue du snapshot ne correspond pas à l’écriture POS';
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

-- Préserver la restitution FEFO historique tout en respectant les réservations modernes (holds).
-- Les anciennes réservations ayant débité un lot doivent restituer le même lot ET le stock agrégé.
create or replace function public.restore_stock(p_resa uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_res public.reservations%rowtype;
  v_item record;
  v_alloc record;
  v_allocated integer;
  v_has_allocation boolean;
begin
  select r.* into v_res
  from public.reservations r
  where r.id = p_resa
  for update;

  if not found then
    raise exception 'Réservation introuvable';
  end if;

  -- Une vente consommée ne peut jamais être remboursée au stock par l'expiration.
  if v_res.consumed_at is not null or v_res.consumed_by_vente_id is not null then
    return;
  end if;
  -- Les nouvelles réservations sont des holds virtuels : aucune quantité physique à restituer.
  if not coalesce(v_res.stock_decremented, false) or coalesce(v_res.stock_restored, false) then
    return;
  end if;
  if not exists (select 1 from public.reservation_items ri where ri.reservation_id = p_resa) then
    raise exception 'Réservation sans lignes : restitution automatique refusée';
  end if;

  perform pg_catalog.set_config('naxa.stock_motif', 'Restitution réservation ' || p_resa::text, true);

  for v_item in
    select ri.produit_id, ri.quantite
    from public.reservation_items ri
    where ri.reservation_id = p_resa
    order by ri.produit_id
  loop
    perform 1
    from public.stocks s
    where s.pharmacie_id = v_res.pharmacie_id
      and s.produit_id = v_item.produit_id
    for update;
    if not found then
      raise exception 'Ligne de stock absente pendant la restitution';
    end if;

    select exists (
      select 1
      from public.reservation_item_lots a
      where a.reservation_id = p_resa
        and a.produit_id = v_item.produit_id
        and a.restauree_at is null
    ) into v_has_allocation;

    if v_has_allocation then
      select coalesce(sum(a.quantite), 0)::integer
      into v_allocated
      from public.reservation_item_lots a
      where a.reservation_id = p_resa
        and a.produit_id = v_item.produit_id
        and a.restauree_at is null;
      if v_allocated <> v_item.quantite then
        raise exception 'Allocation de lots incomplète : réconciliation requise avant restitution';
      end if;

      for v_alloc in
        select a.lot_id, a.quantite
        from public.reservation_item_lots a
        where a.reservation_id = p_resa
          and a.produit_id = v_item.produit_id
          and a.restauree_at is null
        order by a.lot_id
        for update
      loop
        update public.stocks_lots
        set quantite = quantite + v_alloc.quantite,
            updated_at = now()
        where id = v_alloc.lot_id
          and pharmacie_id = v_res.pharmacie_id
          and produit_id = v_item.produit_id;
        if not found then
          raise exception 'Lot d’origine indisponible; restitution annulée';
        end if;
      end loop;

      update public.reservation_item_lots
      set restauree_at = now()
      where reservation_id = p_resa
        and produit_id = v_item.produit_id
        and restauree_at is null;
    elsif exists (
      select 1 from public.stocks_lots sl
      where sl.pharmacie_id = v_res.pharmacie_id
        and sl.produit_id = v_item.produit_id
    ) then
      -- Ne pas inventer une allocation de lot pour les anciennes réservations ambiguës.
      raise exception 'Réservation historique sans allocation de lots : réconciliation requise avant restitution';
    end if;

    update public.stocks
    set quantite = quantite + v_item.quantite,
        updated_at = now()
    where pharmacie_id = v_res.pharmacie_id
      and produit_id = v_item.produit_id;
    if not found then
      raise exception 'Ligne de stock absente pendant la restitution';
    end if;
  end loop;

  update public.reservations
  set stock_restored = true,
      stock_decremented = false
  where id = p_resa
    and stock_restored = false
    and consumed_at is null
    and consumed_by_vente_id is null;
  if not found then
    raise exception 'La réservation a changé pendant la restitution';
  end if;
end;
$function$;

revoke all on function public.restore_stock(uuid) from public, anon, authenticated;
comment on function public.restore_stock(uuid) is
  'Restitution idempotente des réservations legacy : restaure les lots d’origine et le stock agrégé dans la même transaction; ignore les holds modernes et toute réservation consommée.';

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
