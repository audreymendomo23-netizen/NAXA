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
  v_item record;
  v_lot record;
  v_stock_qty integer;
  v_lots_count integer;
  v_remaining integer;
  v_take integer;
  v_legacy_decremented boolean;
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

  -- Nouvelle règle métier : la réservation ne débite pas le stock physique.
  -- Le débit intervient ici, pendant la validation atomique par la caisse.
  -- Les anciennes réservations sont reconnues par le marqueur ajouté en migration 212;
  -- avant cette colonne, l'absence du champ est traitée comme une réservation legacy déjà débitée.
  v_legacy_decremented := coalesce((to_jsonb(r)->>'stock_decremented')::boolean, true);

  for v_item in
    select ri.produit_id, ri.quantite, ri.prix_unitaire
    from public.reservation_items ri
    where ri.reservation_id = r.id
    order by ri.produit_id
  loop
    select s.quantite into v_stock_qty
    from public.stocks s
    where s.pharmacie_id = r.pharmacie_id and s.produit_id = v_item.produit_id
    for update;
    if not found then raise exception 'Produit absent du stock lors de l’encaissement'; end if;

    select count(*) into v_lots_count
    from public.stocks_lots l
    where l.pharmacie_id = r.pharmacie_id and l.produit_id = v_item.produit_id;

    if v_lots_count > 0 then
      v_remaining := v_item.quantite;
      for v_lot in
        select l.id,l.quantite,l.date_peremption
        from public.stocks_lots l
        where l.pharmacie_id=r.pharmacie_id and l.produit_id=v_item.produit_id
          and l.quantite>0 and coalesce(l.bloque,false)=false
          and (l.date_peremption is null or l.date_peremption>=current_date)
        order by l.date_peremption asc nulls last,l.created_at asc,l.id asc
        for update
      loop
        exit when v_remaining=0;
        v_take:=least(v_remaining,v_lot.quantite);
        update public.stocks_lots set quantite=quantite-v_take where id=v_lot.id;
        insert into public.vente_lignes(vente_id,produit_id,lot_id,quantite,prix_unitaire)
        values(v_vente,v_item.produit_id,v_lot.id,v_take,v_item.prix_unitaire);
        v_remaining:=v_remaining-v_take;
      end loop;
      if v_remaining>0 then raise exception 'Lots vendables insuffisants lors de l’encaissement'; end if;
    else
      if exists(select 1 from public.stocks s where s.pharmacie_id=r.pharmacie_id
        and s.produit_id=v_item.produit_id and s.date_peremption is not null
        and s.date_peremption<current_date) then
        raise exception 'Stock périmé : encaissement refusé';
      end if;
      insert into public.vente_lignes(vente_id,produit_id,quantite,prix_unitaire)
      values(v_vente,v_item.produit_id,v_item.quantite,v_item.prix_unitaire);
    end if;

    -- Les réservations legacy ont déjà réduit stocks.quantite à leur création.
    -- Les nouvelles réservations ne la réduisent qu'à la vente validée.
    if not v_legacy_decremented then
      update public.stocks
      set quantite=quantite-v_item.quantite,updated_at=now()
      where pharmacie_id=r.pharmacie_id and produit_id=v_item.produit_id
        and quantite>=v_item.quantite;
      if not found then raise exception 'Stock physique insuffisant lors de l’encaissement'; end if;
    end if;
  end loop;

  perform public.vente_encaisser_finaliser(v_vente, p_montant_percu);

  update public.reservations
  set paiement_mode = 'especes_retrait',
      paiement_ref = null,
      consumed_by_vente_id = v_vente,
      consumed_at = now(),
      stock_decremented = true,
      stock_restored = false
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
  'Réservation Marketplace liée à la vente POS. Unique pour empêcher un double encaissement; le stock physique est débité à la validation de caisse, une seule fois.';

comment on function public.vente_reservation_encaisser(uuid, uuid, integer) is
  'Encaisse une réservation Pharmacie confirmée dans une session ouverte, débite le stock physique à la validation de caisse, lie le ticket POS et consomme la réservation une seule fois dans une transaction atomique.';

commit;
