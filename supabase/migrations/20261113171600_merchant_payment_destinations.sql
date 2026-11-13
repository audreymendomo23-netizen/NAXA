begin;

create table if not exists public.naxa_merchant_payment_destinations (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid references public.pharmacies(id) on delete cascade,
  partner_id uuid references public.partners(id) on delete cascade,
  canal text not null check (canal in ('mtn_momo','orange_money')),
  merchant_name text not null check (length(trim(merchant_name)) between 2 and 120),
  merchant_phone text not null check (
    length(regexp_replace(merchant_phone, '[^0-9]', '', 'g')) between 8 and 15
  ),
  merchant_code text not null check (merchant_code ~ '^[0-9]{6}$'),
  is_active boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint naxa_merchant_payment_destination_owner_ck
    check (num_nonnulls(pharmacie_id, partner_id) = 1)
);

create unique index if not exists naxa_merchant_payment_destination_pharmacy_uq
  on public.naxa_merchant_payment_destinations(pharmacie_id, canal)
  where pharmacie_id is not null;
create unique index if not exists naxa_merchant_payment_destination_partner_uq
  on public.naxa_merchant_payment_destinations(partner_id, canal)
  where partner_id is not null;
create index if not exists naxa_merchant_payment_destinations_active_idx
  on public.naxa_merchant_payment_destinations(canal, is_active, updated_at desc);

create table if not exists public.naxa_merchant_payment_destination_audit (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid references public.naxa_merchant_payment_destinations(id) on delete set null,
  entity_type text not null check (entity_type in ('pharmacie','partner')),
  entity_id uuid not null,
  canal text not null check (canal in ('mtn_momo','orange_money')),
  actor_id uuid not null,
  action text not null check (action in ('created','updated')),
  previous_config jsonb,
  new_config jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists naxa_merchant_payment_destination_audit_entity_idx
  on public.naxa_merchant_payment_destination_audit(entity_type, entity_id, created_at desc);

alter table public.naxa_merchant_payment_destinations enable row level security;
alter table public.naxa_merchant_payment_destination_audit enable row level security;

revoke all on public.naxa_merchant_payment_destinations from public, anon, authenticated;
revoke all on public.naxa_merchant_payment_destination_audit from public, anon, authenticated;
grant all on public.naxa_merchant_payment_destinations to service_role;
grant all on public.naxa_merchant_payment_destination_audit to service_role;

create or replace function public.naxa_save_merchant_payment_destination(
  p_pharmacie_id uuid,
  p_partner_id uuid,
  p_canal text,
  p_merchant_name text,
  p_merchant_phone text,
  p_merchant_code text,
  p_is_active boolean,
  p_actor_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_previous jsonb;
  v_action text;
  v_name text := trim(coalesce(p_merchant_name, ''));
  v_phone text := trim(coalesce(p_merchant_phone, ''));
  v_code text := trim(coalesce(p_merchant_code, ''));
  v_entity_type text;
  v_entity_id uuid;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Service NAXA requis';
  end if;
  if num_nonnulls(p_pharmacie_id, p_partner_id) <> 1 then
    raise exception 'Un seul bénéficiaire doit être renseigné';
  end if;
  if p_canal not in ('mtn_momo','orange_money') then
    raise exception 'Opérateur de paiement invalide';
  end if;
  if length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'Nom du bénéficiaire invalide';
  end if;
  if length(regexp_replace(v_phone, '[^0-9]', '', 'g')) not between 8 and 15 then
    raise exception 'Téléphone marchand invalide';
  end if;
  if v_code !~ '^[0-9]{6}$' then
    raise exception 'Le code marchand doit comporter exactement 6 chiffres';
  end if;
  if p_actor_id is null then raise exception 'Acteur authentifié requis'; end if;

  if p_pharmacie_id is not null then
    if not exists (select 1 from public.pharmacies ph where ph.id=p_pharmacie_id) then
      raise exception 'Pharmacie introuvable';
    end if;
    v_entity_type := 'pharmacie';
    v_entity_id := p_pharmacie_id;
    select d.id, to_jsonb(d) into v_id, v_previous
      from public.naxa_merchant_payment_destinations d
      where d.pharmacie_id=p_pharmacie_id and d.canal=p_canal
      for update;
  else
    if not exists (select 1 from public.partners pa where pa.id=p_partner_id) then
      raise exception 'Partenaire introuvable';
    end if;
    v_entity_type := 'partner';
    v_entity_id := p_partner_id;
    select d.id, to_jsonb(d) into v_id, v_previous
      from public.naxa_merchant_payment_destinations d
      where d.partner_id=p_partner_id and d.canal=p_canal
      for update;
  end if;

  if v_id is null then
    insert into public.naxa_merchant_payment_destinations(
      pharmacie_id,partner_id,canal,merchant_name,merchant_phone,merchant_code,
      is_active,created_by,updated_by,updated_at
    ) values (
      p_pharmacie_id,p_partner_id,p_canal,v_name,v_phone,v_code,
      coalesce(p_is_active,false),p_actor_id,p_actor_id,now()
    ) returning id into v_id;
    v_action := 'created';
  else
    update public.naxa_merchant_payment_destinations
      set merchant_name=v_name,merchant_phone=v_phone,merchant_code=v_code,
          is_active=coalesce(p_is_active,false),updated_by=p_actor_id,updated_at=now()
      where id=v_id;
    v_action := 'updated';
  end if;

  insert into public.naxa_merchant_payment_destination_audit(
    destination_id,entity_type,entity_id,canal,actor_id,action,previous_config,new_config
  ) values (
    v_id,v_entity_type,v_entity_id,p_canal,p_actor_id,v_action,v_previous,
    jsonb_build_object(
      'merchant_name',v_name,'merchant_phone',v_phone,'merchant_code',v_code,
      'is_active',coalesce(p_is_active,false)
    )
  );
  return v_id;
end;
$function$;

revoke all on function public.naxa_save_merchant_payment_destination(uuid,uuid,text,text,text,text,boolean,uuid)
  from public,anon,authenticated;
grant execute on function public.naxa_save_merchant_payment_destination(uuid,uuid,text,text,text,text,boolean,uuid)
  to service_role;

commit;
