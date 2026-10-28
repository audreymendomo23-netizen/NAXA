-- NAXA 252 — retrait en caisse d'une réservation Marketplace approuvée à crédit.
-- Code versionné uniquement. Ne pas appliquer à une base distante sans validation explicite.
begin;

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
      v_remaining:=v_item.quantite;
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
      if v_remaining>0 then raise exception 'Lots vendables insuffisants au retrait'; end if;
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
  update public.client_credit_requests
  set vente_id=v_vente
  where id=q.id and statut='approuvee' and consumed_at is null and vente_id is null;
  if not found then raise exception 'La demande de crédit a déjà été liée à une vente'; end if;

  v_op:=public.client_credit_enregistrer_vente(
    v_vente,r.total,nullif(trim(p_reference),'')
  );
  if v_op is null then raise exception 'Échec de création de l’opération de crédit'; end if;

  -- L’opération d’octroi est aussi rattachée à la session qui a remis les produits.
  update public.client_credit_operations
  set caisse_session_id=p_session
  where id=v_op and vente_id=v_vente and nature='credit';
  if not found then raise exception 'Opération de crédit non rattachée à la session de caisse'; end if;

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
'Finalise atomiquement le retrait d’une réservation Marketplace approuvée à crédit : validation session caisse, débit stock/lots, vente POS, opération de crédit, solde client et consommation de la demande. Aucun paiement espèces n’est déclaré.';

commit;
