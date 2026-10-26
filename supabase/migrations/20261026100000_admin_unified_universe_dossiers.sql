begin;

-- Le dossier administratif transversal complète les modèles métier existants.
alter table public.partners
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6),
  add column if not exists whatsapp text;

create table if not exists public.admin_partner_dossiers (
  partner_id uuid primary key references public.partners(id) on delete cascade,
  promoteur_id uuid not null references public.profiles(id) on delete restrict,
  universe_slug text not null references public.universes(slug) on delete restrict,
  monthly_fee_fcfa bigint not null check (monthly_fee_fcfa > 0),
  architecture_code text,
  documents_received jsonb not null default '{}'::jsonb check (jsonb_typeof(documents_received) = 'object'),
  dossier_status text not null default 'pending' check (dossier_status in ('pending','validated','rejected')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_partner_dossiers_architecture_check check (
    architecture_code is null or architecture_code in ('ORPHELIN','PARENTS_ENFANTS','PARENTS_AINES_CADETS','HYBRIDE')
  ),
  constraint admin_partner_dossiers_architecture_scope_check check (
    (universe_slug = 'parapharmacie' and architecture_code is not null)
    or (universe_slug <> 'parapharmacie' and architecture_code is null)
  )
);
create index if not exists admin_partner_dossiers_promoteur_idx
  on public.admin_partner_dossiers(promoteur_id, created_at desc);
create index if not exists admin_partner_dossiers_universe_idx
  on public.admin_partner_dossiers(universe_slug, dossier_status, created_at desc);
create index if not exists admin_partner_dossiers_created_by_idx
  on public.admin_partner_dossiers(created_by);
alter table public.admin_partner_dossiers enable row level security;
drop policy if exists admin_partner_dossiers_admin_all on public.admin_partner_dossiers;
create policy admin_partner_dossiers_admin_all on public.admin_partner_dossiers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.admin_partner_dossiers from anon, authenticated;
grant select, insert, update, delete on public.admin_partner_dossiers to authenticated;

-- Bébé & Maman est un service d'une pharmacie existante, jamais un établissement autonome.
create table if not exists public.pharmacie_services (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  service_slug text not null references public.universes(slug) on delete restrict check (service_slug = 'bebe-maman'),
  status text not null default 'active' check (status in ('active','inactive')),
  enabled_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pharmacie_id, service_slug)
);
create index if not exists pharmacie_services_status_idx
  on public.pharmacie_services(status, pharmacie_id);
create index if not exists pharmacie_services_enabled_by_idx on public.pharmacie_services(enabled_by);
create index if not exists pharmacie_services_updated_by_idx on public.pharmacie_services(updated_by);
create index if not exists pharmacie_services_service_slug_idx on public.pharmacie_services(service_slug);
alter table public.pharmacie_services enable row level security;
drop policy if exists pharmacie_services_admin_all on public.pharmacie_services;
create policy pharmacie_services_admin_all on public.pharmacie_services
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.pharmacie_services from anon, authenticated;
grant select, insert, update, delete on public.pharmacie_services to authenticated;

create or replace function public.admin_create_partner_dossier(
  p_owner_user_id uuid,
  p_name text,
  p_partner_type text,
  p_universe_slug text,
  p_city text,
  p_neighborhood text,
  p_address text,
  p_latitude numeric,
  p_longitude numeric,
  p_whatsapp text,
  p_monthly_fee_fcfa bigint,
  p_architecture_code text,
  p_documents_received jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_partner_id uuid;
  v_actor uuid := auth.uid();
begin
  if not public.is_admin() then raise exception 'Accès administrateur requis' using errcode = '42501'; end if;
  if p_owner_user_id is null or not exists (
    select 1 from public.profiles where id=p_owner_user_id
  ) then raise exception 'Compte Promoteur introuvable' using errcode = '23503'; end if;
  -- Le compte propriétaire reste suspendu tant que le dossier est en attente.
  update public.profiles set actif=false where id=p_owner_user_id;
  if length(trim(coalesce(p_name,''))) < 2 or length(trim(coalesce(p_city,''))) < 2
     or length(trim(coalesce(p_address,''))) < 2
     or p_latitude is null or p_longitude is null
     or p_monthly_fee_fcfa is null or p_monthly_fee_fcfa <= 0
     or p_universe_slug not in ('parapharmacie','examens','prestations','aide')
     or p_partner_type is distinct from (case p_universe_slug when 'parapharmacie' then 'parapharmacie' when 'examens' then 'centre_examen' when 'prestations' then 'professionnel_domicile' else 'autre' end)
     or (p_universe_slug='parapharmacie' and p_architecture_code not in ('ORPHELIN','PARENTS_ENFANTS','PARENTS_AINES_CADETS','HYBRIDE'))
     or (p_universe_slug<>'parapharmacie' and p_architecture_code is not null)
     or jsonb_typeof(coalesce(p_documents_received,'{}'::jsonb)) <> 'object'
     or (p_latitude is not null and p_latitude not between -90 and 90)
     or (p_longitude is not null and p_longitude not between -180 and 180) then
    raise exception 'Dossier partenaire invalide' using errcode = '22023';
  end if;
  if not exists (select 1 from public.universes where slug=p_universe_slug) then
    raise exception 'Univers indisponible' using errcode = '23503';
  end if;

  insert into public.partners(
    name, partner_type, city, neighborhood, address_private, phone_private, whatsapp,
    latitude, longitude, status, created_by
  ) values (
    trim(p_name),
    case p_universe_slug
      when 'parapharmacie' then 'parapharmacie'
      when 'examens' then 'centre_examen'
      when 'prestations' then 'professionnel_domicile'
      else 'autre'
    end,
    trim(p_city), nullif(trim(coalesce(p_neighborhood,'')),''),
    nullif(trim(coalesce(p_address,'')),''),
    nullif(trim(coalesce(p_whatsapp,'')),''),
    nullif(trim(coalesce(p_whatsapp,'')),''),
    p_latitude, p_longitude, 'pending', v_actor
  ) returning id into v_partner_id;

  insert into public.partner_universes(partner_id, universe_slug, enabled)
    values (v_partner_id, p_universe_slug, false);
  insert into public.partner_members(partner_id, user_id, member_role)
    values (v_partner_id, p_owner_user_id, 'owner');
  insert into public.admin_partner_dossiers(
    partner_id, promoteur_id, universe_slug, monthly_fee_fcfa, architecture_code,
    documents_received, dossier_status, created_by
  ) values (
    v_partner_id, p_owner_user_id, p_universe_slug, p_monthly_fee_fcfa, p_architecture_code,
    coalesce(p_documents_received,'{}'::jsonb), 'pending', v_actor
  );

  if p_universe_slug='examens' then
    insert into public.exam_centers(partner_id, display_name, address_label, status)
    values (v_partner_id, trim(p_name), nullif(trim(coalesce(p_address,'')),''), 'draft');
  end if;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(v_actor,'partner.dossier_created','admin_partner_dossier',v_partner_id::text,
      jsonb_build_object('universe_slug',p_universe_slug,'owner_user_id',p_owner_user_id,'status','pending'));
  return v_partner_id;
end;
$fn$;
revoke all on function public.admin_create_partner_dossier(uuid,text,text,text,text,text,text,numeric,numeric,text,bigint,text,jsonb) from public, anon;
grant execute on function public.admin_create_partner_dossier(uuid,text,text,text,text,text,text,numeric,numeric,text,bigint,text,jsonb) to authenticated;

create or replace function public.admin_set_pharmacie_bebe_maman_service(
  p_pharmacie_id uuid,
  p_enabled boolean
) returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_actor uuid := auth.uid();
begin
  if not public.is_admin() then raise exception 'Accès administrateur requis' using errcode='42501'; end if;
  if p_pharmacie_id is null or p_enabled is null then raise exception 'Pharmacie et état requis' using errcode='22023'; end if;
  if p_enabled and not exists(select 1 from public.pharmacies where id=p_pharmacie_id and actif=true and visible_recherche=true) then
    raise exception 'Pharmacie partenaire active introuvable' using errcode='P0002';
  end if;
  insert into public.pharmacie_services(pharmacie_id,service_slug,status,enabled_by,updated_by)
  values(p_pharmacie_id,'bebe-maman',case when p_enabled then 'active' else 'inactive' end,
         case when p_enabled then v_actor else null end,v_actor)
  on conflict(pharmacie_id,service_slug) do update
    set status=excluded.status,
        enabled_by=case when excluded.status='active' then v_actor else pharmacie_services.enabled_by end,
        updated_by=v_actor,updated_at=now();
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'pharmacy.bebe_maman_service_changed','pharmacie',p_pharmacie_id::text,
    jsonb_build_object('service_slug','bebe-maman','status',case when p_enabled then 'active' else 'inactive' end));
end;
$fn$;
revoke all on function public.admin_set_pharmacie_bebe_maman_service(uuid,boolean) from public, anon;
grant execute on function public.admin_set_pharmacie_bebe_maman_service(uuid,boolean) to authenticated;


create or replace function public.admin_valider_dossier_partenaire(p_partner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := auth.uid();
  v_universe text;
  v_owner uuid;
begin
  if not public.is_admin() then raise exception 'Accès administrateur requis' using errcode='42501'; end if;
  if p_partner_id is null then raise exception 'Dossier partenaire requis' using errcode='22023'; end if;
  select d.universe_slug,d.promoteur_id into v_universe,v_owner
  from public.admin_partner_dossiers d
  join public.partners p on p.id=d.partner_id
  where d.partner_id=p_partner_id and d.dossier_status='pending' and p.status='pending'
  for update of d,p;
  if not found then raise exception 'Dossier partenaire introuvable ou déjà traité' using errcode='P0002'; end if;
  if v_universe <> 'aide' and not exists(
    select 1 from public.universes u
    join public.feature_flags f on f.flag_key='universe.'||u.slug
    where u.slug=v_universe and u.enabled=true and f.enabled=true
  ) then raise exception 'Univers inactif' using errcode='23514'; end if;

  update public.partners set status='active',verified_at=now(),verified_by=v_actor,updated_at=now()
  where id=p_partner_id;
  update public.partner_universes set enabled=true
  where partner_id=p_partner_id and universe_slug=v_universe;
  update public.admin_partner_dossiers set dossier_status='validated',updated_at=now()
  where partner_id=p_partner_id;
  update public.profiles set actif=true where id=v_owner;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'partner.dossier_validated','admin_partner_dossier',p_partner_id::text,
    jsonb_build_object('universe_slug',v_universe,'status','active'));
end;
$fn$;
revoke all on function public.admin_valider_dossier_partenaire(uuid) from public, anon;
grant execute on function public.admin_valider_dossier_partenaire(uuid) to authenticated;


commit;
