-- NAXA 251 — rétablir le vrai modèle de hold sans débit physique.
-- Migration versionnée uniquement : ne pas appliquer à une base distante sans validation explicite.
begin;

create or replace function private.reserve_stock(p_pharmacie uuid,p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_id uuid;
  v_item jsonb;
  v_total bigint:=0;
  v_price integer;
  v_qty integer;
  v_product uuid;
  v_stock integer;
  v_reserved integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not exists(select 1 from public.pharmacies p where p.id=p_pharmacie and p.actif) then
    raise exception 'Pharmacie indisponible';
  end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>10 then
    raise exception 'Panier invalide';
  end if;
  if exists(
    select 1 from (
      select value->>'produit_id' pid,count(*) n
      from jsonb_array_elements(p_items) group by value->>'produit_id'
    ) d where d.n>1
  ) then raise exception 'Produit dupliqué dans le panier'; end if;

  -- Verrouillage déterministe : les quantités réservées restent des holds, pas des sorties.
  for v_item in
    select value from jsonb_array_elements(p_items) order by value->>'produit_id'
  loop
    if coalesce(v_item->>'produit_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Référence produit invalide';
    end if;
    v_product:=(v_item->>'produit_id')::uuid;
    v_qty:=coalesce((v_item->>'quantite')::integer,1);
    if v_qty<1 or v_qty>10 then raise exception 'Quantité invalide'; end if;

    select s.quantite,s.prix into v_stock,v_price
    from public.stocks s
    where s.pharmacie_id=p_pharmacie and s.produit_id=v_product
      and (s.date_peremption is null or s.date_peremption>=current_date)
    for update;
    if not found then raise exception 'Produit absent ou périmé'; end if;

    select coalesce(sum(ri.quantite),0)::integer into v_reserved
    from public.reservation_items ri
    join public.reservations r on r.id=ri.reservation_id
    where r.pharmacie_id=p_pharmacie and ri.produit_id=v_product
      and r.mode='reservation'
      and r.statut in ('en_attente','confirmee')
      and r.expires_at>now() and r.consumed_at is null
      and r.stock_restored=false and r.stock_decremented=false;

    if v_stock-v_reserved<v_qty then
      raise exception 'Stock disponible insuffisant après réservations actives';
    end if;
    v_total:=v_total+v_price::bigint*v_qty;
    if v_total>2147483647 then raise exception 'Total de réservation supérieur à la limite'; end if;
  end loop;

  insert into public.reservations(
    client_id,pharmacie_id,expires_at,mode,stock_decremented,stock_restored
  ) values(auth.uid(),p_pharmacie,now()+interval '4 hours','reservation',false,false)
  returning id into v_id;

  for v_item in
    select value from jsonb_array_elements(p_items) order by value->>'produit_id'
  loop
    v_product:=(v_item->>'produit_id')::uuid;
    v_qty:=coalesce((v_item->>'quantite')::integer,1);
    select s.prix into v_price from public.stocks s
    where s.pharmacie_id=p_pharmacie and s.produit_id=v_product;
    insert into public.reservation_items(reservation_id,produit_id,quantite,prix_unitaire)
    values(v_id,v_product,v_qty,v_price);
  end loop;

  update public.reservations set total=v_total::integer where id=v_id;
  return v_id;
end;
$function$;

revoke all on function private.reserve_stock(uuid,jsonb) from public,anon;
grant execute on function private.reserve_stock(uuid,jsonb) to authenticated;

create or replace function public.reserve_stock(p_pharmacie uuid,p_items jsonb)
returns uuid language sql security invoker set search_path=''
as $function$
  select private.reserve_stock($1,$2)
$function$;

revoke all on function public.reserve_stock(uuid,jsonb) from public,anon;
grant execute on function public.reserve_stock(uuid,jsonb) to authenticated;

comment on function private.reserve_stock(uuid,jsonb) is
  'Crée un hold Marketplace de quatre heures sans diminuer stocks.quantite ni stocks_lots.quantite; le débit physique est réservé à la validation atomique en caisse.';
commit;
