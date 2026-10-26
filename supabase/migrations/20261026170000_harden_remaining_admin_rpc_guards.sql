begin;

-- Remove remaining role='admin' authorization shortcuts from SECURITY DEFINER RPCs.
-- Partner owner/manager scopes remain unchanged; only the global admin override
-- is switched to the canonical active-admin guard.

create or replace function public.expire_universe_reservations(p_limit integer default 500)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare changed integer;
begin
  if coalesce(auth.jwt() ->> 'role','') <> 'service_role'
     and not public.is_admin() then
    raise exception 'Action réservée à l’administration ou au service';
  end if;
  if p_limit < 1 or p_limit > 5000 then raise exception 'Limite invalide'; end if;
  with due as (
    select id from public.universe_reservations
    where status in ('requested','confirmed','ready') and expires_at <= now()
    order by expires_at for update skip locked limit p_limit
  )
  update public.universe_reservations r set status='expired',updated_at=now()
  from due where r.id=due.id;
  get diagnostics changed = row_count;
  if changed > 0 then
    insert into public.audit_log(actor_id,action,entity_type,metadata)
    values(auth.uid(),'reservations.expired.batch','universe_reservation_batch',
      jsonb_build_object('count',changed,'processed_at',now()));
  end if;
  return changed;
end;
$function$;

create or replace function public.generate_exam_slots_for_center(p_center_id uuid, p_days integer default 14)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
declare h record; d date; ts timestamp; v_count integer:=0; v_tz text:='Africa/Douala';
begin
  if auth.uid() is null or p_center_id is null then
    raise exception 'Connexion requise' using errcode='28000';
  end if;
  if not exists(
    select 1 from public.exam_centers c
    join public.partner_members pm on pm.partner_id=c.partner_id
    where c.id=p_center_id and pm.user_id=auth.uid() and pm.member_role in ('owner','manager')
  ) and not public.is_admin() then
    raise exception 'Accès refusé' using errcode='42501';
  end if;
  if p_days<1 or p_days>14 then raise exception 'La génération est limitée à 14 jours' using errcode='22023'; end if;
  for h in select ch.weekday,ch.opens_at,ch.closes_at,ch.slot_minutes,ch.capacity
    from public.exam_center_hours ch where ch.center_id=p_center_id and ch.enabled=true
  loop
    for d in select (current_timestamp at time zone v_tz)::date + g from generate_series(0,p_days-1) g loop
      if extract(dow from d)=h.weekday then
        ts:=d+h.opens_at;
        while ts + make_interval(mins=>h.slot_minutes) <= d+h.closes_at loop
          if (ts at time zone v_tz)>now() then
            insert into public.exam_slots(center_id,starts_at,ends_at,capacity)
            values(p_center_id,ts at time zone v_tz,(ts+make_interval(mins=>h.slot_minutes)) at time zone v_tz,h.capacity)
            on conflict(center_id,starts_at) do nothing;
            if found then v_count:=v_count+1; end if;
          end if;
          ts:=ts+make_interval(mins=>h.slot_minutes);
        end loop;
      end if;
    end loop;
  end loop;
  return v_count;
end;
$function$;

create or replace function public.get_home_service_request_receipt(p_request_id uuid)
returns table(
  request_id uuid, status text, offer_name text, category text, price_fcfa integer,
  partner_name text, service_area_label text, preferred_at timestamptz, created_at timestamptz,
  exact_address text, contact_phone text, client_note text
)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare uid uuid:=auth.uid(); r public.home_service_requests%rowtype;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select * into r from public.home_service_requests where id=p_request_id;
  if not found then raise exception 'Demande introuvable'; end if;
  if r.client_id<>uid and not public.is_admin() then
    raise exception 'Accès refusé' using errcode='42501';
  end if;
  return query
  select r.id,r.status,r.offer_name,r.category,r.price_fcfa,p.name,r.service_area_label,r.preferred_at,r.created_at,
    a.exact_address,a.contact_phone,r.client_note
  from public.partners p
  left join public.home_service_request_addresses a on a.request_id=r.id
  where p.id=r.partner_id;
end;
$function$;

create or replace function public.is_suivi_test_account(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select p_user_id is not null
    and (
      p_user_id = auth.uid()
      or public.is_admin()
    )
    and exists (
      select 1 from public.feature_flags f
      where f.flag_key = 'suivi_connecte' and f.enabled = true
    );
$function$;

create or replace function public.partner_adjust_universe_stock(
  p_product_id uuid, p_quantity_delta numeric, p_movement_type text, p_reason text default null
)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  product_row public.partner_products%rowtype;
  next_quantity numeric(12,3);
  clean_reason text := left(trim(coalesce(p_reason,'')),240);
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  if p_product_id is null or p_quantity_delta is null
    or p_quantity_delta=0 or abs(p_quantity_delta)>1000000
    or p_quantity_delta::text in ('NaN','Infinity','-Infinity') then
    raise exception 'Quantité invalide';
  end if;
  if p_movement_type not in ('receipt','adjustment','loss','return','transfer_in','transfer_out','opening') then
    raise exception 'Type de mouvement invalide';
  end if;
  select pp.* into product_row from public.partner_products pp where pp.id=p_product_id for update;
  if not found then raise exception 'Produit introuvable'; end if;
  if not exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id and pa.status='active'
    join public.partner_universes pu on pu.partner_id=pa.id
      and pu.universe_slug=product_row.universe_slug and pu.enabled=true
    where pm.partner_id=product_row.partner_id and pm.user_id=uid
      and pm.member_role in ('owner','manager','operator')
  ) and not public.is_admin() then
    raise exception 'Action non autorisée';
  end if;
  next_quantity := product_row.stock_quantity + p_quantity_delta;
  if next_quantity < 0 then raise exception 'Le stock ne peut pas devenir négatif'; end if;
  update public.partner_products set stock_quantity=next_quantity,updated_at=now() where id=p_product_id;
  insert into public.stock_movements(partner_id,product_id,quantity_delta,movement_type,reason,reference,created_by)
  values(product_row.partner_id,p_product_id,p_quantity_delta,p_movement_type,
    nullif(clean_reason,''),'manual:'||gen_random_uuid()::text,uid);
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(uid,'partner_stock.adjusted','partner_product',p_product_id::text,
    jsonb_build_object('delta',p_quantity_delta,'resulting_stock',next_quantity,
      'movement_type',p_movement_type,'reason',nullif(clean_reason,'')));
  return next_quantity;
end;
$function$;

create or replace function public.partner_import_universe_products(p_partner_id uuid, p_universe_slug text, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions'
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
  select 1 from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id and pa.status='active'
  join public.partner_universes pu on pu.partner_id=pa.id and pu.universe_slug=p_universe_slug and pu.enabled=true
  where pm.partner_id=p_partner_id and pm.user_id=uid and pm.member_role in ('owner','manager','operator')
 ) and not public.is_admin() then
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

commit;
