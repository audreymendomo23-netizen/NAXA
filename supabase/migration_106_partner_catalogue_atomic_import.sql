-- NAXA 106 — import catalogue atomique avec journalisation du stock initial.
begin;
create or replace function public.partner_import_universe_products(p_partner_id uuid,p_universe_slug text,p_rows jsonb)
returns integer language plpgsql security definer set search_path=public,extensions
as $function$
declare
 uid uuid := auth.uid();
 row_data jsonb;
 new_product public.partner_products%rowtype;
 qty numeric(12,3);
 inserted_count integer := 0;
 row_count integer;
begin
 if uid is null then raise exception 'Connexion requise'; end if;
 if p_universe_slug not in ('parapharmacie','bebe-maman') then raise exception 'Univers invalide'; end if;
 if jsonb_typeof(p_rows) <> 'array' then raise exception 'Import invalide'; end if;
 row_count := jsonb_array_length(p_rows);
 if row_count < 1 or row_count > 500 then raise exception 'Limite import invalide'; end if;
 if not exists(
  select 1 from public.partner_members pm join public.partners pa on pa.id=pm.partner_id and pa.status='active'
  join public.partner_universes pu on pu.partner_id=pa.id and pu.universe_slug=p_universe_slug and pu.enabled=true
  where pm.partner_id=p_partner_id and pm.user_id=uid and pm.member_role in ('owner','manager','operator')
 ) and not exists(select 1 from public.profiles p where p.id=uid and p.role='admin') then
  raise exception 'Action non autorisée';
 end if;
 for row_data in select value from jsonb_array_elements(p_rows) loop
  qty := (row_data->>'stock_quantity')::numeric;
  if length(trim(coalesce(row_data->>'name',''))) not between 2 and 180
    or coalesce((row_data->>'price_fcfa')::integer,-1) < 0
    or qty < 0 or qty > 1000000
    or coalesce((row_data->>'low_stock_threshold')::numeric,3) < 0
    or coalesce((row_data->>'low_stock_threshold')::numeric,3) > 1000000
    or (nullif(row_data->>'expires_at','') is not null and (row_data->>'expires_at')::date is null) then
    raise exception 'Ligne CSV invalide';
  end if;
  insert into public.partner_products(partner_id,universe_slug,name,brand,category,description,photo_url,price_fcfa,stock_quantity,unit_label,expires_at,low_stock_threshold,status,created_by)
  values(p_partner_id,p_universe_slug,trim(row_data->>'name'),nullif(left(row_data->>'brand',120),''),coalesce(nullif(left(row_data->>'category',100),''),'Autres'),
    nullif(left(row_data->>'description',600),''),nullif(row_data->>'photo_url',''),(row_data->>'price_fcfa')::integer,0,
    coalesce(nullif(left(row_data->>'unit_label',30),''),'unité'),nullif(row_data->>'expires_at','')::date,
    coalesce((row_data->>'low_stock_threshold')::numeric,3),'draft',uid)
  returning * into new_product;
  if qty > 0 then
   update public.partner_products set stock_quantity=qty,updated_at=now() where id=new_product.id;
   insert into public.stock_movements(partner_id,product_id,quantity_delta,movement_type,reason,reference,created_by)
   values(p_partner_id,new_product.id,qty,'opening','Stock initial import CSV','csv-import:'||new_product.id::text,uid);
  end if;
  inserted_count := inserted_count + 1;
 end loop;
 insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
 values(uid,'partner.catalogue.csv_import','partner',p_partner_id::text,jsonb_build_object('universe',p_universe_slug,'rows',inserted_count));
 return inserted_count;
end;
$function$;
revoke all on function public.partner_import_universe_products(uuid,text,jsonb) from public,anon;
grant execute on function public.partner_import_universe_products(uuid,text,jsonb) to authenticated;
commit;
