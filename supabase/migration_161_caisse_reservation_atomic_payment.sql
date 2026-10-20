-- NAXA 161 — encaissement comptoir des réservations Marketplace via la caisse POS.
-- Le stock de la réservation est déjà réservé : cette vente POS enregistre le paiement
-- et la session de caisse sans débiter une seconde fois le stock.
begin;

alter table public.ventes
  add column if not exists reservation_id uuid
  references public.reservations(id) on delete restrict;

create unique index if not exists ventes_reservation_id_uq
  on public.ventes(reservation_id)
  where reservation_id is not null;

create or replace function public.vente_reservation_encaisser(
  p_reservation uuid,
  p_session uuid,
  p_montant_percu integer
)
returns table(
  vente_id uuid,
  numero_vente text,
  total integer,
  monnaie_rendue integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  r public.reservations%rowtype;
  v_session public.caisses_sessions%rowtype;
  v_vente uuid;
  v_numero text;
  v_total_lignes integer;
  v_monnaie integer;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  if p_reservation is null or p_session is null then
    raise exception 'Réservation et session de caisse requises';
  end if;
  if p_montant_percu is null or p_montant_percu <= 0 then
    raise exception 'Montant espèces reçu invalide';
  end if;

  select * into r
  from public.reservations
  where id = p_reservation
  for update;

  if not found then
    raise exception 'Réservation introuvable';
  end if;
  if r.mode <> 'reservation' then
    raise exception 'Seules les réservations avec retrait en pharmacie sont encaissables ici';
  end if;
  if r.statut <> 'confirmee' then
    raise exception 'La réservation doit être confirmée par la pharmacie avant encaissement';
  end if;
  if r.expires_at <= now() then
    raise exception 'Réservation expirée : aucun encaissement ne peut être effectué';
  end if;
  if r.paiement_statut = 'effectue' then
    raise exception 'Cette réservation est déjà marquée comme payée';
  end if;
  if r.paiement_mode is not null and r.paiement_mode not in ('especes_retrait', 'a_convenir') then
    raise exception 'Le mode choisi ne peut pas être confirmé en espèces par la caisse. Vérifiez le paiement selon le mode indiqué.';
  end if;
  if not public.naxa_caisse_actor_for_pharmacy(r.pharmacie_id) then
    raise exception 'Encaissement réservé à un compte Caisse actif de cette pharmacie';
  end if;

  select cs.* into v_session
  from public.caisses_sessions cs
  join public.caisses c on c.id = cs.caisse_id
  where cs.id = p_session
    and cs.statut = 'ouverte'
    and cs.ouvert_par = auth.uid()
    and c.actif = true
    and c.pharmacie_id = r.pharmacie_id
  for update of cs;

  if not found then
    raise exception 'Session ouverte introuvable, inactive ou hors pharmacie';
  end if;

  if exists (
    select 1 from public.ventes v
    where v.reservation_id = r.id
  ) then
    raise exception 'Une vente POS est déjà liée à cette réservation';
  end if;

  select coalesce(sum(ri.quantite * ri.prix_unitaire), 0)::integer
    into v_total_lignes
  from public.reservation_items ri
  where ri.reservation_id = r.id;

  if not exists (
    select 1 from public.reservation_items ri where ri.reservation_id = r.id
  ) then
    raise exception 'Réservation sans articles : encaissement refusé';
  end if;
  if v_total_lignes <> r.total then
    raise exception 'Le total des articles ne correspond pas au total de la réservation';
  end if;
  if p_montant_percu < r.total then
    raise exception 'Montant espèces insuffisant';
  end if;

  insert into public.ventes(
    pharmacie_id, caisse_session_id, client_id, statut,
    remise, total_brut, total_net, created_by, reservation_id
  )
  values(
    r.pharmacie_id, p_session, r.client_id, 'brouillon',
    0, r.total, r.total, auth.uid(), r.id
  )
  returning id into v_vente;

  -- La réservation a déjà réservé les quantités. Copier les lignes dans le ticket
  -- POS sans toucher à stocks ni stocks_lots évite un double débit de stock.
  insert into public.vente_lignes(vente_id, produit_id, quantite, prix_unitaire)
  select v_vente, ri.produit_id, ri.quantite, ri.prix_unitaire
  from public.reservation_items ri
  where ri.reservation_id = r.id
  order by ri.produit_id;

  perform public.vente_encaisser_finaliser(v_vente, p_montant_percu);

  update public.reservations
  set paiement_mode = 'especes_retrait',
      paiement_ref = null
  where id = r.id;

  perform public.set_reservation_status(r.id, 'payee'::public.resa_statut);

  select v.numero_vente into v_numero
  from public.ventes v
  where v.id = v_vente;

  v_monnaie := p_montant_percu - r.total;
  return query select v_vente, v_numero, r.total, v_monnaie;
end;
$function$;

revoke all on function public.vente_reservation_encaisser(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.vente_reservation_encaisser(uuid, uuid, integer) to authenticated;

comment on column public.ventes.reservation_id is
  'Réservation Marketplace liée à la vente POS. Unique pour empêcher un double encaissement; le stock de la réservation n’est pas débité une seconde fois.';

comment on function public.vente_reservation_encaisser(uuid, uuid, integer) is
  'Encaisse une réservation Pharmacie confirmée en espèces dans une session ouverte, crée le ticket POS lié et marque le paiement dans une transaction atomique.';

commit;
