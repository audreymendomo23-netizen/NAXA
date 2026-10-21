-- NAXA 215 — physical stock moves only on successful POS finalization.
-- Legacy drafts remain marked as already debited; new drafts are reservations in the POS,
-- not physical stock mutations. Marketplace reservations remain temporary sellable-stock holds.
begin;

alter table public.ventes
  add column if not exists stock_decremented_at_draft boolean not null default true;
alter table public.ventes
  alter column stock_decremented_at_draft set default false;

create or replace function public.marketplace_offre_stock_disponible(
  p_pharmacie uuid,
  p_produit uuid
)
returns table(prix integer, quantite integer)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_stock public.stocks%rowtype;
  v_has_lots boolean;
  v_sellable integer;
  v_reserved integer;
begin
  if p_pharmacie is null or p_produit is null then return; end if;

  select s.* into v_stock
  from public.stocks s
  join public.pharmacies ph on ph.id=s.pharmacie_id
  where s.pharmacie_id=p_pharmacie and s.produit_id=p_produit
    and ph.actif=true and ph.visible_recherche=true;
  if not found then return; end if;

  select coalesce(sum(ri.quantite),0)::integer into v_reserved
  from public.reservation_items ri
  join public.reservations r on r.id=ri.reservation_id
  where r.pharmacie_id=p_pharmacie and ri.produit_id=p_produit
    and r.statut in ('en_attente','confirmee')
    and r.expires_at>now()
    and r.consumed_at is null
    and coalesce(r.stock_restored,false)=false
    and coalesce(r.stock_decremented,false)=false;

  select exists(select 1 from public.stocks_lots l
    where l.pharmacie_id=p_pharmacie and l.produit_id=p_produit)
    into v_has_lots;

  if v_has_lots then
    select coalesce(sum(l.quantite),0)::integer into v_sellable
    from public.stocks_lots l
    where l.pharmacie_id=p_pharmacie and l.produit_id=p_produit
      and coalesce(l.bloque,false)=false
      and (l.date_peremption is null or l.date_peremption>=current_date);
  else
    v_sellable := case
      when v_stock.date_peremption is null or v_stock.date_peremption>=current_date
        then greatest(coalesce(v_stock.quantite,0),0)
      else 0
    end;
  end if;

  return query select v_stock.prix,greatest(coalesce(v_sellable,0)-coalesce(v_reserved,0),0);
end;
$function$;

revoke all on function public.marketplace_offre_stock_disponible(uuid,uuid) from public;
grant execute on function public.marketplace_offre_stock_disponible(uuid,uuid) to anon,authenticated;

-- Internal primitive: only called from the trigger that transitions a draft sale to paid.
-- It checks holds again, debits lots FEFO and aggregate stock atomically, then records lot IDs.
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
    'produit_id',g.produit_id,'quantite',g.quantite,'prix_unitaire',g.prix_unitaire
  ) order by g.produit_id,g.prix_unitaire),'[]'::jsonb)
  into v_original
  from (
    select vl.produit_id,vl.prix_unitaire,sum(vl.quantite)::integer as quantite
    from public.vente_lignes vl where vl.vente_id=p_vente
    group by vl.produit_id,vl.prix_unitaire
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
               (e.value->>'prix_unitaire')::integer as prix_unitaire
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
          insert into public.vente_lignes(vente_id,produit_id,lot_id,quantite,prix_unitaire)
          values(p_vente,v_product.produit_id,v_lot.id,v_take,v_price_group.prix_unitaire);
          v_remaining:=v_remaining-v_take;
        end loop;
        if v_remaining>0 then
          raise exception 'Lots vendables insuffisants, expirés ou bloqués à la validation';
        end if;
      end loop;
    else
      for v_price_group in
        select (e.value->>'quantite')::integer as quantite,
               (e.value->>'prix_unitaire')::integer as prix_unitaire
        from jsonb_array_elements(v_original) e
        where (e.value->>'produit_id')::uuid=v_product.produit_id
        order by (e.value->>'prix_unitaire')::integer
      loop
        insert into public.vente_lignes(vente_id,produit_id,lot_id,quantite,prix_unitaire)
        values(p_vente,v_product.produit_id,null,v_price_group.quantite,v_price_group.prix_unitaire);
      end loop;
    end if;

    update public.stocks
    set quantite=quantite-v_product.quantite,updated_at=now()
    where pharmacie_id=v_vente.pharmacie_id and produit_id=v_product.produit_id
      and quantite>=v_product.quantite;
    if not found then raise exception 'Débit agrégé impossible : stock insuffisant'; end if;
  end loop;

  perform public.vente_recalculer_totaux(p_vente);
end;
$function$;
revoke all on function private.naxa_pos_debit_stock(uuid) from public,anon,authenticated;

create or replace function public.naxa_pos_debit_before_sale_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.statut='brouillon' and new.statut='payee' and not old.stock_decremented_at_draft then
    perform private.naxa_pos_debit_stock(old.id);
    new.stock_decremented_at_draft:=true;
  end if;
  return new;
end;
$function$;
revoke all on function public.naxa_pos_debit_before_sale_paid() from public,anon,authenticated;
drop trigger if exists trg_naxa_pos_debit_before_sale_paid on public.ventes;
create trigger trg_naxa_pos_debit_before_sale_paid
before update of statut on public.ventes
for each row
when (old.statut='brouillon' and new.statut='payee')
execute function public.naxa_pos_debit_before_sale_paid();

create or replace function public.vente_ajouter_produit(
  p_vente uuid,p_produit uuid,p_quantite integer
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_vente public.ventes%rowtype;
  v_prix integer;
  v_sellable integer;
  v_current integer;
  v_other_drafts integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_vente is null or p_produit is null or p_quantite is null or p_quantite<=0 then
    raise exception 'Vente, produit et quantité positive requis';
  end if;
  select * into v_vente from public.ventes where id=p_vente for update;
  if not found or v_vente.statut<>'brouillon' then raise exception 'Vente introuvable ou déjà finalisée'; end if;
  if v_vente.stock_decremented_at_draft then
    raise exception 'Ancien panier déjà débité : abandonnez-le puis créez une nouvelle vente avant de poursuivre';
  end if;
  if v_vente.created_by is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Seul le créateur du panier peut le modifier';
  end if;
  if not (public.is_admin() or public.naxa_caisse_actor_for_pharmacy(v_vente.pharmacie_id)) then
    raise exception 'Vente hors périmètre Caisse';
  end if;
  if not exists (
    select 1 from public.caisses_sessions cs
    where cs.id=v_vente.caisse_session_id and cs.statut='ouverte'
      and (public.is_admin() or cs.ouvert_par=auth.uid())
  ) then raise exception 'Session de caisse fermée ou hors périmètre'; end if;

  select s.prix into v_prix
  from public.stocks s
  where s.pharmacie_id=v_vente.pharmacie_id and s.produit_id=p_produit
  for update;
  if not found then raise exception 'Produit absent du stock de la pharmacie'; end if;

  select coalesce(max(a.quantite),0)::integer into v_sellable
  from public.marketplace_offre_stock_disponible(v_vente.pharmacie_id,p_produit) a;
  select coalesce(sum(vl.quantite),0)::integer into v_current
  from public.vente_lignes vl where vl.vente_id=p_vente and vl.produit_id=p_produit;
  select coalesce(sum(vl.quantite),0)::integer into v_other_drafts
  from public.vente_lignes vl join public.ventes other on other.id=vl.vente_id
  where other.pharmacie_id=v_vente.pharmacie_id and other.statut='brouillon'
    and other.id<>p_vente and other.stock_decremented_at_draft=false
    and vl.produit_id=p_produit;
  if greatest(coalesce(v_sellable,0)-coalesce(v_other_drafts,0),0)<v_current+p_quantite then
    raise exception 'Quantité vendable insuffisante après réservations Marketplace et autres paniers';
  end if;

  insert into public.vente_lignes(vente_id,produit_id,quantite,prix_unitaire)
  values(p_vente,p_produit,p_quantite,v_prix);
  perform public.vente_recalculer_totaux(p_vente);
  return p_quantite;
end;
$function$;
revoke all on function public.vente_ajouter_produit(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.vente_ajouter_produit(uuid,uuid,integer) to authenticated;

-- New drafts release lines without stock mutation; legacy already-debited drafts restore once.
create or replace function public.vente_produit_retirer(p_vente uuid,p_produit uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_vente public.ventes%rowtype;
  v_ligne record;
  v_retirer integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into v_vente from public.ventes where id=p_vente for update;
  if not found or v_vente.statut<>'brouillon' then raise exception 'Vente introuvable ou déjà finalisée'; end if;
  if v_vente.created_by is distinct from auth.uid() and not public.is_admin() then raise exception 'Seul le créateur du panier peut retirer un produit'; end if;
  if not (public.is_admin() or public.naxa_caisse_actor_for_pharmacy(v_vente.pharmacie_id)) then raise exception 'Vente hors périmètre Caisse'; end if;
  if not exists(select 1 from public.caisses_sessions cs where cs.id=v_vente.caisse_session_id and cs.statut='ouverte' and (public.is_admin() or cs.ouvert_par=auth.uid())) then
    raise exception 'Session de caisse fermée ou hors périmètre';
  end if;
  select coalesce(sum(quantite),0)::integer into v_retirer from public.vente_lignes where vente_id=p_vente and produit_id=p_produit;
  if v_retirer<=0 then raise exception 'Produit absent du panier'; end if;

  if v_vente.stock_decremented_at_draft then
    for v_ligne in select lot_id,quantite from public.vente_lignes where vente_id=p_vente and produit_id=p_produit for update loop
      if v_ligne.lot_id is not null then
        update public.stocks_lots set quantite=quantite+v_ligne.quantite where id=v_ligne.lot_id and pharmacie_id=v_vente.pharmacie_id and produit_id=p_produit;
        if not found then raise exception 'Lot d’origine introuvable ; retrait annulé'; end if;
      end if;
      update public.stocks set quantite=quantite+v_ligne.quantite,updated_at=now() where pharmacie_id=v_vente.pharmacie_id and produit_id=p_produit;
      if not found then raise exception 'Stock agrégé d’origine introuvable ; retrait annulé'; end if;
    end loop;
  end if;
  perform set_config('naxa.pos_internal_mutation','remove_line',true);
  delete from public.vente_lignes where vente_id=p_vente and produit_id=p_produit;
  perform set_config('naxa.pos_internal_mutation','',true);
  perform public.vente_recalculer_totaux(p_vente);
  return v_retirer;
end;
$function$;
revoke all on function public.vente_produit_retirer(uuid,uuid) from public,anon,authenticated;
grant execute on function public.vente_produit_retirer(uuid,uuid) to authenticated;

create or replace function public.vente_brouillon_abandonner(p_vente uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_vente public.ventes%rowtype;
  v_ligne record;
  v_owner uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into v_vente from public.ventes where id=p_vente for update;
  if not found or v_vente.statut<>'brouillon' then raise exception 'Seul un panier brouillon peut être abandonné'; end if;
  if v_vente.created_by is distinct from auth.uid() and not public.is_admin() then raise exception 'Seul le créateur du panier ou NAXA peut l’abandonner'; end if;
  if not (public.is_admin() or public.naxa_caisse_actor_for_pharmacy(v_vente.pharmacie_id)) then raise exception 'Vente hors périmètre Caisse'; end if;
  select cs.ouvert_par into v_owner from public.caisses_sessions cs where cs.id=v_vente.caisse_session_id and cs.statut='ouverte' for update;
  if v_owner is null then raise exception 'La session de caisse n’est pas ouverte'; end if;
  if not public.is_admin() and v_owner is distinct from auth.uid() then raise exception 'Seul le titulaire de la session peut abandonner ce panier'; end if;

  if v_vente.stock_decremented_at_draft then
    for v_ligne in select produit_id,lot_id,quantite from public.vente_lignes where vente_id=p_vente order by id for update loop
      if v_ligne.lot_id is not null then
        update public.stocks_lots set quantite=quantite+v_ligne.quantite where id=v_ligne.lot_id and pharmacie_id=v_vente.pharmacie_id and produit_id=v_ligne.produit_id;
        if not found then raise exception 'Lot d’origine introuvable ; abandon annulé'; end if;
      end if;
      update public.stocks set quantite=quantite+v_ligne.quantite,updated_at=now() where pharmacie_id=v_vente.pharmacie_id and produit_id=v_ligne.produit_id;
      if not found then raise exception 'Stock agrégé d’origine introuvable ; abandon annulé'; end if;
    end loop;
  end if;
  update public.ventes set statut='annulee' where id=p_vente and statut='brouillon';
  if not found then raise exception 'Le panier a changé de statut pendant l’abandon'; end if;
end;
$function$;
revoke all on function public.vente_brouillon_abandonner(uuid) from public,anon,authenticated;
grant execute on function public.vente_brouillon_abandonner(uuid) to authenticated;

-- A paid POS sale consumes the reservation exactly once, in the same transaction.
create or replace function public.naxa_pos_mark_reservation_consumed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.reservation_id is not null and old.statut='brouillon' and new.statut='payee' then
    update public.reservations
    set consumed_by_vente_id=new.id,consumed_at=coalesce(consumed_at,now()),
        stock_decremented=true,stock_restored=false
    where id=new.reservation_id and pharmacie_id=new.pharmacie_id;
    if not found then raise exception 'Réservation liée introuvable ; encaissement annulé'; end if;
  end if;
  return new;
end;
$function$;
revoke all on function public.naxa_pos_mark_reservation_consumed() from public,anon,authenticated;
drop trigger if exists trg_naxa_pos_mark_reservation_consumed on public.ventes;
create trigger trg_naxa_pos_mark_reservation_consumed
after update of statut on public.ventes
for each row
when (old.statut='brouillon' and new.statut='payee' and new.reservation_id is not null)
execute function public.naxa_pos_mark_reservation_consumed();

commit;