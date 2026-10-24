-- NAXA: restore the strict server-side POS receipt checks lost in the unified cron migration.
begin;
create or replace function public.get_client_reservation_ticket(p_reservation_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare
  v_res public.reservations%rowtype;
  v_sale public.ventes%rowtype;
  v_items jsonb;
  v_payments jsonb;
  v_lines_total bigint;
  v_payments_total bigint;
  v_last_payment public.vente_paiements%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_reservation_id is null then raise exception 'Référence de réservation requise'; end if;

  select r.* into v_res from public.reservations r
   where r.id = p_reservation_id and r.client_id = auth.uid()
     and r.statut::text in ('payee','retiree')
     and r.paiement_statut in ('effectue','payee');
  if not found then raise exception 'Ticket indisponible pour cette réservation'; end if;

  select v.* into v_sale from public.ventes v
   where v.reservation_id = v_res.id and v.client_id = auth.uid()
     and v.pharmacie_id = v_res.pharmacie_id and v.statut::text = 'payee'
     and v.paid_at is not null
   order by v.paid_at desc, v.created_at desc limit 1;
  if not found then raise exception 'Aucune vente POS payée correspondante'; end if;

  if v_res.paiement_ticket_numero is not null and v_res.paiement_ticket_numero is distinct from v_sale.numero_vente
    then raise exception 'Le numéro du ticket ne correspond pas à la vente POS'; end if;
  if v_sale.total_net is distinct from v_res.total then raise exception 'Le total POS ne correspond pas à la réservation'; end if;

  select coalesce(sum(l.total_ligne),0) into v_lines_total from public.vente_lignes l where l.vente_id=v_sale.id;
  select coalesce(sum(p.montant),0) into v_payments_total from public.vente_paiements p where p.vente_id=v_sale.id;
  select p.* into v_last_payment from public.vente_paiements p where p.vente_id=v_sale.id order by p.created_at desc,p.id desc limit 1;

  select coalesce(jsonb_agg(jsonb_build_object('produit_id',l.produit_id,'produit_nom',coalesce(pr.nom,'Article'),'produit_dosage',pr.dosage,'quantite',l.quantite,'prix_unitaire',l.prix_unitaire,'total_ligne',l.total_ligne) order by l.id),'[]'::jsonb)
    into v_items from public.vente_lignes l left join public.produits pr on pr.id=l.produit_id where l.vente_id=v_sale.id;
  select coalesce(jsonb_agg(jsonb_build_object('mode',p.mode::text,'montant',p.montant,'montant_percu',p.montant_percu,'monnaie_rendue',p.monnaie_rendue,'created_at',p.created_at) order by p.created_at,p.id),'[]'::jsonb)
    into v_payments from public.vente_paiements p where p.vente_id=v_sale.id;

  if jsonb_array_length(v_items)=0 then raise exception 'Ticket POS incomplet : aucune ligne'; end if;
  if jsonb_array_length(v_payments)=0 or v_last_payment.id is null then raise exception 'Ticket POS incomplet : aucun paiement'; end if;
  if v_lines_total is distinct from v_sale.total_brut::bigint then raise exception 'Les lignes ne correspondent pas au total brut POS'; end if;
  if v_payments_total is distinct from v_sale.total_net::bigint then raise exception 'Les paiements ne correspondent pas au total net POS'; end if;
  if v_res.paiement_montant_percu is not null and v_res.paiement_montant_percu is distinct from v_last_payment.montant_percu
    then raise exception 'Le montant encaissé du ticket est incohérent'; end if;
  if v_res.paiement_monnaie_rendue is not null and v_res.paiement_monnaie_rendue is distinct from v_last_payment.monnaie_rendue
    then raise exception 'La monnaie rendue du ticket est incohérente'; end if;

  return jsonb_build_object('receipt_type','cashier_ticket',
    'sale',jsonb_build_object('vente_id',v_sale.id,'numero_vente',v_sale.numero_vente,'pharmacie_id',v_sale.pharmacie_id,'statut',v_sale.statut::text,'created_at',v_sale.created_at,'paid_at',v_sale.paid_at,'total_brut',v_sale.total_brut,'remise',v_sale.remise,'total_net',v_sale.total_net,'mode_paiement',v_sale.mode_paiement::text,'paiement_ref',v_sale.paiement_ref,'caissier_id',v_sale.created_by,'caisse_session_id',v_sale.caisse_session_id),
    'items',v_items,'payments',v_payments,
    'reservation',jsonb_build_object('reservation_id',v_res.id,'ticket_numero_snapshot',v_res.paiement_ticket_numero,'montant_percu_snapshot',v_res.paiement_montant_percu,'monnaie_rendue_snapshot',v_res.paiement_monnaie_rendue,'paiement_valide_at',v_res.paiement_valide_at));
end;
$function$;
revoke all on function public.get_client_reservation_ticket(uuid) from public, anon;
grant execute on function public.get_client_reservation_ticket(uuid) to authenticated;
comment on function public.get_client_reservation_ticket(uuid) is 'Ticket POS vérifié côté serveur : propriétaire, pharmacie, vente payée, lignes, paiements et snapshots cohérents.';
commit;
