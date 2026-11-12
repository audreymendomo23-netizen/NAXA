-- NAXA 200 — réserver/restaurer les lots avec la réservation existante, sans double débit POS.
-- Préserve le contrat historique : le stock agrégé est réservé à la création; la caisse
-- encaisse la réservation confirmée sans débiter une seconde fois.
begin;

create table if not exists public.reservation_item_lots (
 reservation_id uuid not null references public.reservations(id) on delete restrict,
 produit_id uuid not null references public.produits(id) on delete restrict,
 lot_id uuid not null references public.stocks_lots(id) on delete restrict,
 quantite integer not null check(quantite>0),
 cree_le timestamptz not null default now(),
 restauree_at timestamptz,
 primary key(reservation_id,produit_id,lot_id)
);
create index if not exists reservation_item_lots_lot_idx on public.reservation_item_lots(lot_id);
alter table public.reservation_item_lots enable row level security;
drop policy if exists reservation_item_lots_participant_read on public.reservation_item_lots;
-- The canonical scope helper may be installed later in Preview's mixed legacy/canonical replay.
-- If it is not available yet, the policy is installed by the canonical lifecycle migration
-- immediately after the helper definition; never create a permissive fallback policy.
do $policy$
begin
  if to_regprocedure('public.naxa_scope_allows(uuid,uuid,text)') is not null then
    execute $create$
      create policy reservation_item_lots_participant_read
      on public.reservation_item_lots
      for select to authenticated
      using (
        exists (
          select 1
          from public.reservations r
          where r.id=reservation_item_lots.reservation_id
            and (
              r.client_id=(select auth.uid())
              or public.is_admin()
              or public.naxa_scope_allows((select auth.uid()),r.pharmacie_id,'PHARMACIE')
            )
        )
      )
    $create$;
  end if;
end;
$policy$;
revoke all on public.reservation_item_lots from public,anon,authenticated;
grant select on public.reservation_item_lots to authenticated;

-- Contradiction / migration des réservations actives historiques :
-- les anciens flux décrémentaient stocks.quantite mais pas nécessairement les lots.
-- On ne devine pas un stock initial : on ne réconcilie que si lots = stock actuel + quantités
-- déjà réservées. Toute incohérence inconnue arrête la migration avec un message exploitable.
do $preflight$
declare v record; v_lots bigint; v_stock bigint; v_reserved bigint;
begin
 for v in
  select distinct s.pharmacie_id,s.produit_id
  from public.stocks s join public.stocks_lots sl
   on sl.pharmacie_id=s.pharmacie_id and sl.produit_id=s.produit_id
 loop
  select coalesce(sum(sl.quantite),0) into v_lots from public.stocks_lots sl
   where sl.pharmacie_id=v.pharmacie_id and sl.produit_id=v.produit_id;
  select s.quantite into v_stock from public.stocks s
   where s.pharmacie_id=v.pharmacie_id and s.produit_id=v.produit_id;
  select coalesce(sum(ri.quantite),0) into v_reserved
   from public.reservation_items ri join public.reservations r on r.id=ri.reservation_id
   where r.pharmacie_id=v.pharmacie_id and r.mode='reservation' and r.statut in ('en_attente','confirmee')
    and ri.produit_id=v.produit_id;
  if v_lots <> v_stock + v_reserved then
   raise exception 'Réconciliation requise avant migration 200 pour pharmacie %, produit % : lots %, stock agrégé %, réservations actives %. Aucun stock modifié.',
    v.pharmacie_id,v.produit_id,v_lots,v_stock,v_reserved;
  end if;
 end loop;
end;
$preflight$;

-- Attribue les réservations historiques actives aux lots FEFO utilisables, puis aligne
-- les lots sur le stock agrégé qui est déjà net des réservations.
do $backfill$
declare r record; v_lot record; v_need integer; v_take integer; v_total integer;
begin
 for r in
  select res.id as reservation_id,res.pharmacie_id,res.expires_at,ri.produit_id,ri.quantite
  from public.reservations res join public.reservation_items ri on ri.reservation_id=res.id
  where res.mode='reservation' and res.statut in ('en_attente','confirmee')
   and exists(select 1 from public.stocks_lots sl where sl.pharmacie_id=res.pharmacie_id and sl.produit_id=ri.produit_id)
  order by res.created_at,res.id,ri.produit_id
 loop
  if exists(select 1 from public.reservation_item_lots a where a.reservation_id=r.reservation_id and a.produit_id=r.produit_id) then
   continue;
  end if;
  v_need:=r.quantite;
  select coalesce(sum(sl.quantite),0)::integer into v_total from public.stocks_lots sl
   where sl.pharmacie_id=r.pharmacie_id and sl.produit_id=r.produit_id
    and (r.expires_at<=now() or (not sl.bloque and sl.date_peremption>=current_date));
  if v_total<v_need then
   raise exception 'Réservation active % : lots utilisables insuffisants pour le produit %. Réconciliation manuelle requise; aucun déploiement applicatif.',r.reservation_id,r.produit_id;
  end if;
  for v_lot in
   select sl.id,sl.quantite from public.stocks_lots sl
   where sl.pharmacie_id=r.pharmacie_id and sl.produit_id=r.produit_id and sl.quantite>0
    and (r.expires_at<=now() or (not sl.bloque and sl.date_peremption>=current_date))
   order by case when r.expires_at<=now() then sl.date_peremption end nulls first,sl.date_peremption,sl.numero_lot,sl.id for update
  loop
   exit when v_need=0;
   v_take:=least(v_need,v_lot.quantite);
   if v_take>0 then
    update public.stocks_lots set quantite=quantite-v_take,updated_at=now() where id=v_lot.id;
    insert into public.reservation_item_lots(reservation_id,produit_id,lot_id,quantite)
    values(r.reservation_id,r.produit_id,v_lot.id,v_take);
    v_need:=v_need-v_take;
   end if;
  end loop;
  if v_need<>0 then raise exception 'Allocation FEFO incomplète pour la réservation %',r.reservation_id; end if;
 end loop;
end;
$backfill$;

create or replace function private.reserve_stock(p_pharmacie uuid,p_items jsonb)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare
 v_id uuid; v_item jsonb; v_total bigint:=0; v_price integer; v_qty integer;
 v_stock integer; v_lot_total integer; v_usable integer; v_need integer; v_take integer;
 v_lot record; v_has_lots boolean;
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 if not exists(select 1 from public.pharmacies p where p.id=p_pharmacie and p.actif=true) then raise exception 'Pharmacie indisponible'; end if;
 if p_items is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>10 then raise exception 'Panier invalide'; end if;
 if exists(select 1 from (select value->>'produit_id' pid,count(*) n from jsonb_array_elements(p_items) group by value->>'produit_id' having count(*)>1) d) then raise exception 'Produit dupliqué dans le panier'; end if;
 insert into public.reservations(client_id,pharmacie_id,expires_at,mode) values(auth.uid(),p_pharmacie,now()+interval '4 hours','reservation') returning id into v_id;
 perform pg_catalog.set_config('naxa.stock_motif','Réservation Marketplace '||v_id::text,true);
 for v_item in select value from jsonb_array_elements(p_items) order by value->>'produit_id'
 loop
  if coalesce(v_item->>'produit_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'Référence produit invalide'; end if;
  v_qty:=coalesce((v_item->>'quantite')::integer,1);
  if v_qty<1 or v_qty>10 then raise exception 'Quantité invalide'; end if;
  select s.quantite,s.prix into v_stock,v_price from public.stocks s
   where s.pharmacie_id=p_pharmacie and s.produit_id=(v_item->>'produit_id')::uuid for update;
  if not found or v_stock<v_qty then raise exception 'Stock insuffisant pour un des produits'; end if;
  select exists(select 1 from public.stocks_lots sl where sl.pharmacie_id=p_pharmacie and sl.produit_id=(v_item->>'produit_id')::uuid)
   into v_has_lots;
  if v_has_lots then
   select coalesce(sum(sl.quantite),0)::integer into v_lot_total from public.stocks_lots sl
    where sl.pharmacie_id=p_pharmacie and sl.produit_id=(v_item->>'produit_id')::uuid;
   if v_lot_total<>v_stock then raise exception 'Stock agrégé et lots incohérents : réconciliation requise avant réservation'; end if;
   select coalesce(sum(sl.quantite),0)::integer into v_usable from public.stocks_lots sl
    where sl.pharmacie_id=p_pharmacie and sl.produit_id=(v_item->>'produit_id')::uuid
     and not sl.bloque and sl.date_peremption>=current_date;
   if v_usable<v_qty then raise exception 'Lots non périmés et non bloqués insuffisants'; end if;
  end if;
  insert into public.reservation_items(reservation_id,produit_id,quantite,prix_unitaire)
   values(v_id,(v_item->>'produit_id')::uuid,v_qty,v_price);
  if v_has_lots then
   v_need:=v_qty;
   for v_lot in select sl.id,sl.quantite from public.stocks_lots sl
    where sl.pharmacie_id=p_pharmacie and sl.produit_id=(v_item->>'produit_id')::uuid
     and not sl.bloque and sl.date_peremption>=current_date and sl.quantite>0
    order by sl.date_peremption,sl.numero_lot,sl.id for update
   loop
    exit when v_need=0;
    v_take:=least(v_need,v_lot.quantite);
    if v_take>0 then
     update public.stocks_lots set quantite=quantite-v_take,updated_at=now() where id=v_lot.id;
     insert into public.reservation_item_lots(reservation_id,produit_id,lot_id,quantite)
      values(v_id,(v_item->>'produit_id')::uuid,v_lot.id,v_take);
     v_need:=v_need-v_take;
    end if;
   end loop;
   if v_need<>0 then raise exception 'Allocation de lots incomplète'; end if;
  end if;
  update public.stocks set quantite=quantite-v_qty
   where pharmacie_id=p_pharmacie and produit_id=(v_item->>'produit_id')::uuid and quantite>=v_qty;
  if not found then raise exception 'Stock modifié simultanément; réessayez'; end if;
  v_total:=v_total+v_price::bigint*v_qty;
  if v_total>2147483647 then raise exception 'Total de réservation supérieur à la limite de stockage'; end if;
 end loop;
 update public.reservations set total=v_total::integer where id=v_id;
 return v_id;
end;
$function$;

create or replace function public.restore_stock(p_resa uuid)
returns void language plpgsql security definer set search_path=''
as $function$
declare r public.reservations%rowtype; v_item record; v_alloc record; v_has_lots boolean; v_restored integer;
begin
 select * into r from public.reservations where id=p_resa for update;
 if not found then raise exception 'Réservation introuvable'; end if;
 perform pg_catalog.set_config('naxa.stock_motif','Restitution réservation '||p_resa::text,true);
 for v_item in select ri.produit_id,ri.quantite from public.reservation_items ri where ri.reservation_id=p_resa order by ri.produit_id
 loop
  perform 1 from public.stocks s where s.pharmacie_id=r.pharmacie_id and s.produit_id=v_item.produit_id for update;
  if not found then raise exception 'Ligne de stock absente pendant la restitution'; end if;
  select exists(select 1 from public.reservation_item_lots a where a.reservation_id=p_resa and a.produit_id=v_item.produit_id and a.restauree_at is null)
   into v_has_lots;
  if v_has_lots then
   for v_alloc in select a.lot_id,a.quantite from public.reservation_item_lots a
    where a.reservation_id=p_resa and a.produit_id=v_item.produit_id and a.restauree_at is null for update
   loop
    update public.stocks_lots set quantite=quantite+v_alloc.quantite,updated_at=now() where id=v_alloc.lot_id
     and pharmacie_id=r.pharmacie_id and produit_id=v_item.produit_id;
    if not found then raise exception 'Lot d’origine indisponible; restitution annulée'; end if;
   end loop;
   update public.reservation_item_lots set restauree_at=now()
    where reservation_id=p_resa and produit_id=v_item.produit_id and restauree_at is null;
  else
   if exists(select 1 from public.stocks_lots sl where sl.pharmacie_id=r.pharmacie_id and sl.produit_id=v_item.produit_id) then
    raise exception 'Réservation historique sans allocation de lots : réconciliation requise avant restitution';
   end if;
  end if;
  update public.stocks set quantite=quantite+v_item.quantite
   where pharmacie_id=r.pharmacie_id and produit_id=v_item.produit_id;
  if not found then raise exception 'Ligne de stock absente pendant la restitution'; end if;
 end loop;
end;
$function$;

create or replace function private.naxa_guard_lot_creation_with_unallocated_reservations()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
 if exists(
  select 1 from public.reservations r
  join public.reservation_items ri on ri.reservation_id=r.id
  where r.pharmacie_id=new.pharmacie_id and ri.produit_id=new.produit_id
   and r.mode='reservation' and r.statut in ('en_attente','confirmee')
   and coalesce((select sum(a.quantite) from public.reservation_item_lots a
    where a.reservation_id=r.id and a.produit_id=ri.produit_id and a.restauree_at is null),0)<ri.quantite
 ) then
  raise exception 'Création du premier lot refusée : une réservation active de ce produit n’a pas d’allocation de lot. Confirmez/annulez les dossiers concernés avant de lotiser.';
 end if;
 return new;
end;
$function$;
revoke all on function private.naxa_guard_lot_creation_with_unallocated_reservations() from public,anon,authenticated;
drop trigger if exists trg_stock_lot_requires_active_reservation_allocation on public.stocks_lots;
create trigger trg_stock_lot_requires_active_reservation_allocation
before insert on public.stocks_lots for each row
execute function private.naxa_guard_lot_creation_with_unallocated_reservations();

revoke all on function public.restore_stock(uuid) from public,anon,authenticated;
comment on table public.reservation_item_lots is 'Allocation FEFO des lots réservés; conserve la traçabilité et restaure chaque lot une seule fois en cas d’annulation/expiration.';
comment on function private.reserve_stock(uuid,jsonb) is 'Réserve le stock agrégé et les lots FEFO utilisables dans la même transaction; une vente POS liée n’effectue aucun second débit.';
comment on function public.restore_stock(uuid) is 'Restitue une réservation annulée/expirée dans les lots d’origine et le stock agrégé dans une transaction unique.';
commit;
