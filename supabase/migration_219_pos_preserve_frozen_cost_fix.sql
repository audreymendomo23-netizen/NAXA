-- NAXA 219 — include frozen cost in all FEFO line-rebuild branches.
begin;
create or replace function private.naxa_pos_debit_stock(p_vente uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_vente public.ventes%rowtype;
  v_original jsonb;
  v_product record;
  v_price_group record;
  v_lot record;
  v_stock_qty integer;
  v_sellable integer;
  v_own_hold integer;
  v_other_drafts integer;
  v_lots_count integer;
  v_remaining integer;
  v_take integer;
  v_qty integer;
begin
  select * into v_vente from public.ventes where id=p_vente for update;
  if not found or v_vente.statut<>'brouillon' then
    raise exception 'Vente introuvable ou déjà finalisée';
  end if;
  if v_vente.stock_decremented_at_draft then return; end if;
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not (public.is_admin() or public.naxa_caisse_actor_for_pharmacy(v_vente.pharmacie_id)) then
    raise exception 'Débit de stock réservé à la caisse autorisée de cette pharmacie';
  end if;
  if not exists (
    select 1 from public.caisses_sessions cs
    join public.caisses c on c.id=cs.caisse_id
    where cs.id=v_vente.caisse_session_id and cs.statut='ouverte'
      and c.pharmacie_id=v_vente.pharmacie_id and c.actif=true
      and (public.is_admin() or cs.ouvert_par=auth.uid())
    for update of cs
  ) then
    raise exception 'Session de caisse fermée, inactive ou hors pharmacie';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'produit_id',g.produit_id,'quantite',g.quantite,'prix_unitaire',g.prix_unitaire,'cout_unitaire_fige',g.cout_unitaire_fige
  ) order by g.produit_id,g.prix_unitaire,g.cout_unitaire_fige),'[]'::jsonb)
  into v_original
  from (
    select vl.produit_id,vl.prix_unitaire,vl.cout_unitaire_fige,sum(vl.quantite)::integer as quantite
    from public.vente_lignes vl where vl.vente_id=p_vente
    group by vl.produit_id,vl.prix_unitaire,vl.cout_unitaire_fige
  ) g;

  if jsonb_array_length(v_original)=0 then raise exception 'Vente vide'; end if;

  -- Validate every product before mutating any lot or aggregate quantity.
  for v_product in
    select (e.value->>'produit_id')::uuid as produit_id,
           sum((e.value->>'quantite')::integer)::integer as quantite
    from jsonb_array_elements(v_original) e
    group by (e.value->>'produit_id')::uuid
    order by (e.value->>'produit_id')::uuid
  loop
    select s.quantite into v_stock_qty
    from public.stocks s
    where s.pharmacie_id=v_vente.pharmacie_id and s.produit_id=v_product.produit_id
    for update;
    if not found or coalesce(v_stock_qty,0)<v_product.quantite then
      raise exception 'Stock physique insuffisant à la validation de caisse';
    end if;

    select coalesce(max(a.quantite),0)::integer into v_sellable
    from public.marketplace_offre_stock_disponible(v_vente.pharmacie_id,v_product.produit_id) a;

    v_own_hold:=0;
    if v_vente.reservation_id is not null then
      select coalesce(sum(ri.quantite),0)::integer into v_own_hold
      from public.reservation_items ri
      where ri.reservation_id=v_vente.reservation_id and ri.produit_id=v_product.produit_id;
    end if;

    select coalesce(sum(vl.quantite),0)::integer into v_other_drafts
    from public.vente_lignes vl
    join public.ventes other on other.id=vl.vente_id
    where other.pharmacie_id=v_vente.pharmacie_id
      and other.statut='brouillon'
      and other.id<>p_vente
      and other.stock_decremented_at_draft=false
      and vl.produit_id=v_product.produit_id;

    if greatest(coalesce(v_sellable,0)+coalesce(v_own_hold,0)-coalesce(v_other_drafts,0),0)<v_product.quantite then
      raise exception 'Stock vendable insuffisant après prise en compte des réservations Marketplace et autres paniers';
    end if;
  end loop;

  -- Original draft lines have no lot allocation and did not change stock.
  perform set_config('naxa.pos_internal_mutation','remove_line',true);
  delete from public.vente_lignes where vente_id=p_vente;
  perform set_config('naxa.pos_internal_mutation','',true);

  for v_product in
    select (e.value->>'produit_id')::uuid as produit_id,
           sum((e.value->>'quantite')::integer)::integer as quantite
    from jsonb_array_elements(v_original) e
    group by (e.value->>'produit_id')::uuid
    order by (e.value->>'produit_id')::uuid
  loop
    select count(*)::integer into v_lots_count
    from public.stocks_lots l
    where l.pharmacie_id=v_vente.pharmacie_id and l.produit_id=v_product.produit_id;

    if v_lots_count>0 then
      for v_price_group in
        select (e.value->>'quantite')::integer as quantite,
               (e.value->>'prix_unitaire')::integer as prix_unitaire,
               (e.value->>'cout_unitaire_fige')::integer as cout_unitaire_fige
        from jsonb_array_elements(v_original) e
        where (e.value->>'produit_id')::uuid=v_product.produit_id
        order by (e.value->>'prix_unitaire')::integer
      loop
        v_remaining:=v_price_group.quantite;
        for v_lot in
          select l.id,l.quantite
          from public.stocks_lots l
          where l.pharmacie_id=v_vente.pharmacie_id
            and l.produit_id=v_product.produit_id
            and l.quantite>0
            and coalesce(l.bloque,false)=false
            and (l.date_peremption is null or l.date_peremption>=current_date)
          order by l.date_peremption asc nulls last,l.created_at asc,l.id asc
          for update
        loop
          exit when v_remaining=0;
          v_take:=least(v_remaining,v_lot.quantite);
          update public.stocks_lots set quantite=quantite-v_take where id=v_lot.id;
          insert into public.vente_lignes(vente_id,produit_id,lot_id,quantite,prix_unitaire,cout_unitaire_fige)
          values(p_vente,v_product.produit_id,v_lot.id,v_take,v_price_group.prix_unitaire,v_price_group.cout_unitaire_fige);
          v_remaining:=v_remaining-v_take;
        end loop;
        if v_remaining>0 then
          raise exception 'Lots vendables insuffisants, expirés ou bloqués à la validation';
        end if;
      end loop;
    else
      for v_price_group in
        select (e.value->>'quantite')::integer as quantite,
               (e.value->>'prix_unitaire')::integer as prix_unitaire,
               (e.value->>'cout_unitaire_fige')::integer as cout_unitaire_fige
        from jsonb_array_elements(v_original) e
        where (e.value->>'produit_id')::uuid=v_product.produit_id
        order by (e.value->>'prix_unitaire')::integer
      loop
        insert into public.vente_lignes(vente_id,produit_id,lot_id,quantite,prix_unitaire,cout_unitaire_fige)
        values(p_vente,v_product.produit_id,null,v_price_group.quantite,v_price_group.prix_unitaire,v_price_group.cout_unitaire_fige);
      end loop;
    end if;

    update public.stocks
    set quantite=quantite-v_product.quantite,updated_at=now()
    where pharmacie_id=v_vente.pharmacie_id and produit_id=v_product.produit_id
      and quantite>=v_product.quantite;
    if not found then raise exception 'Débit agrégé impossible : stock insuffisant'; end if;
  end loop;

end;
$function$;
revoke all on function private.naxa_pos_debit_stock(uuid) from public,anon,authenticated;
commit;