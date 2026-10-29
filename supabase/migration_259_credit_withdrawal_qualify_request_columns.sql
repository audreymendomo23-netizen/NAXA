-- NAXA 259 — correction du conflit PL/pgSQL entre vente_id retourné et colonne vente_id.
-- Reprend le contrat de retrait 256 en qualifiant la table client_credit_requests.
-- Correctif versionné uniquement : ne pas appliquer à une base distante sans validation explicite.
begin;

-- Le retrait crédit doit pouvoir marquer la réservation comme crédit sans violer
-- l'ancien CHECK qui n'acceptait que les canaux de paiement Marketplace classiques.
alter table public.reservations
  drop constraint if exists reservations_paiement_mode_check;
alter table public.reservations
  add constraint reservations_paiement_mode_check
  check (
    paiement_mode is null
    or paiement_mode = any(array[
      'mtn_marchand'::text,
      'orange_money'::text,
      'especes_retrait'::text,
      'especes_livraison'::text,
      'a_convenir'::text,
      'credit'::text
    ])
  );

create or replace function public.vente_reservation_credit_finaliser(
  p_reservation uuid,
  p_session uuid,
  p_reference text default null
)
returns table(vente_id uuid,numero_vente text,total integer)
language plpgsql
security definer
set search_path=''
as $function$
declare
  r public.reservations%rowtype;
  q public.client_credit_requests%rowtype;
  v_session public.caisses_sessions%rowtype;
  v_vente uuid;
  v_numero text;
  v_total_lignes integer;
  v_item record;
  v_lot record;
  v_lots_count integer;
  v_allocated integer;
  v_remaining integer;
  v_take integer;
  v_legacy_decremented boolean;
  v_op uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_reservation is null or p_session is null then
    raise exception 'Réservation et session de caisse requises';
  end if;

  select * into r from public.reservations where id=p_reservation for update;
  if not found then raise exception 'Réservation introuvable'; end if;
  if r.mode<>'reservation' or r.statut<>'confirmee' then
    raise exception 'La réservation doit être confirmée pour le retrait';
  end if;
  if r.expires_at<=now() then raise exception 'Réservation expirée'; end if;
  if r.paiement_statut='effectue' then raise exception 'Réservation déjà payée'; end if;
  if not public.naxa_caisse_actor_for_pharmacy(r.pharmacie_id) then
    raise exception 'Opération réservée à la caisse active de cette pharmacie';
  end if;
  if exists(select 1 from public.ventes v where v.reservation_id=r.id) then
    raise exception 'Une vente POS est déjà liée à cette réservation';
  end if;
  if r.credit_request_id is null then
    raise exception 'Cette réservation ne provient pas d’une demande de crédit Marketplace';
  end if;

  select * into q
  from public.client_credit_requests
  where id=r.credit_request_id
  for update;
  if not found or q.origine<>'marketplace' or q.statut<>'approuvee'
     or q.reservation_id is distinct from r.id or q.consumed_at is not null
     or q.vente_id is not null then
    raise exception 'Demande de crédit absente, non approuvée ou déjà consommée';
  end if;
  if q.client_id is distinct from r.client_id
     or q.pharmacie_id is distinct from r.pharmacie_id
     or q.credit_id is null then
    raise exception 'La demande de crédit ne correspond pas à cette réservation';
  end if;

  select cs.* into v_session
  from public.caisses_sessions cs
  join public.caisses c on c.id=cs.caisse_id
  where cs.id=p_session and cs.statut='ouverte'
    and cs.ouvert_par=auth.uid() and c.actif=true
    and c.pharmacie_id=r.pharmacie_id
  for update of cs;
  if not found then raise exception 'Session ouverte introuvable, inactive ou hors pharmacie'; end if;

  select coalesce(sum(ri.quantite*ri.prix_unitaire),0)::integer
  into v_total_lignes
  from public.reservation_items ri where ri.reservation_id=r.id;
  if not exists(select 1 from public.reservation_items ri where ri.reservation_id=r.id) then
    raise exception 'Réservation sans articles';
  end if;
  if v_total_lignes<>r.total or q.montant<>r.total then
    raise exception 'Le total des articles, de la réservation et du crédit doit être identique';
  end if;

  insert into public.ventes(
    pharmacie_id,caisse_session_id,client_id,statut,remise,total_brut,total_net,created_by,reservation_id
  ) values(
    r.pharmacie_id,p_session,r.client_id,'brouillon',0,r.total,r.total,auth.uid(),r.id
  ) returning id into v_vente;

  v_legacy_decremented:=coalesce((to_jsonb(r)->>'stock_decremented')::boolean,true);
  for v_item in
    select ri.produit_id,ri.quantite,ri.prix_unitaire
    from public.reservation_items ri where ri.reservation_id=r.id order by ri.produit_id
  loop
    perform 1 from public.stocks s
    where s.pharmacie_id=r.pharmacie_id and s.produit_id=v_item.produit_id
    for update;
    if not found then raise exception 'Produit absent du stock au retrait'; end if;

    select count(*) into v_lots_count from public.stocks_lots l
    where l.pharmacie_id=r.pharmacie_id and l.produit_id=v_item.produit_id;
    if v_lots_count>0 then
      -- Le retrait doit consommer les lots affectés à CETTE réservation, pas
      -- recalculer un FEFO global qui pourrait prendre les lots d'un autre hold.
      select coalesce(sum(a.quantite),0)::integer into v_allocated
      from public.reservation_item_lots a
      where a.reservation_id=r.id and a.produit_id=v_item.produit_id
        and a.restauree_at is null;
      if v_allocated<>v_item.quantite then
        raise exception 'Allocation de lots absente ou incohérente pour la réservation';
      end if;

      v_remaining:=v_item.quantite;
      for v_lot in
        select l.id,l.quantite,l.date_peremption,a.quantite as reserve_qty
        from public.reservation_item_lots a
        join public.stocks_lots l on l.id=a.lot_id
          and l.pharmacie_id=r.pharmacie_id and l.produit_id=v_item.produit_id
        where a.reservation_id=r.id and a.produit_id=v_item.produit_id
          and a.restauree_at is null and a.quantite>0
          and l.quantite>0 and coalesce(l.bloque,false)=false
          and (l.date_peremption is null or l.date_peremption>=current_date)
        order by l.date_peremption asc nulls last,l.created_at asc,l.id asc
        for update of l,a
      loop
        exit when v_remaining=0;
        v_take:=least(v_remaining,v_lot.reserve_qty);
        if v_lot.quantite<v_take then
          raise exception 'Quantité insuffisante dans un lot affecté à cette réservation';
        end if;
        update public.stocks_lots set quantite=quantite-v_take where id=v_lot.id;
        insert into public.vente_lignes(vente_id,produit_id,lot_id,quantite,prix_unitaire)
        values(v_vente,v_item.produit_id,v_lot.id,v_take,v_item.prix_unitaire);
        v_remaining:=v_remaining-v_take;
      end loop;
      if v_remaining>0 then raise exception 'Lots affectés indisponibles au retrait'; end if;
    else
      if exists(select 1 from public.stocks s where s.pharmacie_id=r.pharmacie_id
        and s.produit_id=v_item.produit_id and s.date_peremption is not null
        and s.date_peremption<current_date) then
        raise exception 'Stock périmé : retrait refusé';
      end if;
      insert into public.vente_lignes(vente_id,produit_id,quantite,prix_unitaire)
      values(v_vente,v_item.produit_id,v_item.quantite,v_item.prix_unitaire);
    end if;

    if not v_legacy_decremented then
      update public.stocks set quantite=quantite-v_item.quantite,updated_at=now()
      where pharmacie_id=r.pharmacie_id and produit_id=v_item.produit_id
        and quantite>=v_item.quantite;
      if not found then raise exception 'Stock physique insuffisant au retrait'; end if;
    end if;
  end loop;

  -- La demande est liée à la vente avant l'enregistrement du crédit : le RPC existant
  -- vérifie l'approbation, applique le plafond autorisé, marque la demande consommée,
  -- met à jour le solde et crée l'unique opération de crédit liée à cette vente.
  update public.client_credit_requests as cr
  set vente_id=v_vente
  where cr.id=q.id and cr.statut='approuvee'
    and cr.consumed_at is null and cr.vente_id is null;
  if not found then raise exception 'La demande de crédit a déjà été liée à une vente'; end if;

  v_op:=public.client_credit_enregistrer_vente(
    v_vente,r.total,nullif(trim(p_reference),'')
  );
  if v_op is null then raise exception 'Échec de création de l’opération de crédit'; end if;

  -- Le snapshot de reçu POS exige un montant perçu et une monnaie rendue, y compris
  -- pour un paiement intégral par crédit (monnaie rendue = 0).
  update public.vente_paiements as vp
  set montant_percu=r.total, monnaie_rendue=0
  where vp.vente_id=v_vente and vp.mode='credit';
  if not found then raise exception 'Paiement POS crédit absent ou incomplet'; end if;

  -- L’opération d’octroi est aussi rattachée à la session qui a remis les produits.
  update public.client_credit_operations as op
  set caisse_session_id=p_session
  where op.id=v_op and op.vente_id=v_vente and op.nature='credit';
  if not found then raise exception 'Opération de crédit non rattachée à la session de caisse'; end if;

  -- Le paiement de crédit doit aussi finaliser la vente POS avant la transition
  -- de réservation vers payee, qui exige un ticket POS effectivement payé.
  update public.ventes as v
  set statut='payee',
      mode_paiement='credit',
      paiement_ref=nullif(trim(p_reference),''),
      paid_at=now()
  where v.id=v_vente and v.statut='brouillon';
  if not found then raise exception 'La vente crédit n’a pas pu être finalisée'; end if;

  update public.reservations
  set paiement_mode='credit',
      paiement_ref=nullif(trim(p_reference),''),
      consumed_by_vente_id=v_vente,
      consumed_at=now(),
      stock_decremented=true,
      stock_restored=false
  where id=r.id;

  perform public.set_reservation_status(r.id,'payee'::public.resa_statut);
  select v.numero_vente into v_numero from public.ventes v where v.id=v_vente;
  return query select v_vente,v_numero,r.total;
end;
$function$;


revoke all on function public.vente_reservation_credit_finaliser(uuid,uuid,text) from public,anon;
grant execute on function public.vente_reservation_credit_finaliser(uuid,uuid,text) to authenticated;
comment on function public.vente_reservation_credit_finaliser(uuid,uuid,text) is
'Finalise atomiquement le retrait d’une réservation Marketplace approuvée à crédit : consomme exclusivement les lots affectés au hold, vérifie la session caisse, débite stock/lots, crée la vente et l’opération de crédit, puis marque la demande consommée. Aucun paiement espèces n’est déclaré.';

commit;
