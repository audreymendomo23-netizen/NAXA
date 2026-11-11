-- NAXA — RBAC ERP Parapharmacie : mêmes rôles et matrice d'architecture,
-- comptes professionnels séparés et périmètre partenaire strict.
begin;

-- 1. Identité professionnelle : un compte ne peut appartenir qu'à un domaine ERP.
create table if not exists public.naxa_professional_account_domains (
  profile_id uuid primary key references public.profiles(id) on delete restrict,
  domain_code text not null check (domain_code in ('PHARMACIE','PARAPHARMACIE')),
  created_at timestamptz not null default now()
);
alter table public.naxa_professional_account_domains enable row level security;
revoke all on public.naxa_professional_account_domains from public, anon, authenticated;

create or replace function private.naxa_ensure_professional_account_domain(
  p_profile uuid,
  p_domain text
) returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_existing text;
begin
  if p_profile is null or p_domain not in ('PHARMACIE','PARAPHARMACIE') then
    raise exception 'Domaine professionnel invalide';
  end if;

  select domain_code into v_existing
  from public.naxa_professional_account_domains
  where profile_id=p_profile
  for update;

  if v_existing is not null then
    if v_existing<>p_domain then
      raise exception 'Ce compte professionnel est déjà rattaché à un autre domaine NAXA';
    end if;
    return;
  end if;

  if p_domain='PARAPHARMACIE' then
    if exists (
      select 1 from public.profiles p
      where p.id=p_profile and p.role::text in ('admin','pharmacie','caisse')
    ) or exists (
      select 1 from public.naxa_professional_assignments a
      where a.profile_id=p_profile
    ) or exists (
      select 1 from public.promoteur_pharmacies pp
      where pp.promoteur_id=p_profile
    ) or exists (
      select 1 from public.naxa_profile_active_roles ar
      where ar.profile_id=p_profile and ar.pharmacie_id is not null
    ) then
      raise exception 'Un compte professionnel Pharmacie ne peut pas être réutilisé en Parapharmacie';
    end if;
  else
    if exists (
      select 1
      from public.partner_members pm
      join public.partners pa on pa.id=pm.partner_id
      where pm.user_id=p_profile and pa.partner_type='parapharmacie'
    ) or exists (
      select 1 from public.naxa_partner_professional_assignments a
      where a.profile_id=p_profile
    ) then
      raise exception 'Un compte professionnel Parapharmacie ne peut pas être réutilisé en Pharmacie';
    end if;
  end if;

  insert into public.naxa_professional_account_domains(profile_id,domain_code)
  values(p_profile,p_domain);
end;
$function$;

revoke all on function private.naxa_ensure_professional_account_domain(uuid,text) from public,anon,authenticated;

-- Détecter d'abord les comptes historiques partagés : la migration s'arrête plutôt
-- que de fusionner silencieusement deux identités professionnelles.
do $backfill$
begin
  if exists (
    with pharmacy_accounts as (
      select p.id as profile_id
      from public.profiles p
      where p.role::text in ('pharmacie','caisse')
      union
      select a.profile_id from public.naxa_professional_assignments a
      union
      select pp.promoteur_id from public.promoteur_pharmacies pp
      union
      select ar.profile_id from public.naxa_profile_active_roles ar
      where ar.pharmacie_id is not null
    ),
    para_accounts as (
      select pm.user_id as profile_id
      from public.partner_members pm
      join public.partners pa on pa.id=pm.partner_id
      where pa.partner_type='parapharmacie'
    )
    select 1 from pharmacy_accounts f
    join para_accounts p using(profile_id)
  ) then
    raise exception 'Audit requis : au moins un compte est partagé entre Pharmacie et Parapharmacie. Séparer les identités avant migration.';
  end if;
end;
$backfill$;

insert into public.naxa_professional_account_domains(profile_id,domain_code)
select profile_id,'PHARMACIE'
from (
  select p.id as profile_id
  from public.profiles p
  where p.role::text in ('pharmacie','caisse')
  union
  select a.profile_id from public.naxa_professional_assignments a
  union
  select pp.promoteur_id from public.promoteur_pharmacies pp
  union
  select ar.profile_id from public.naxa_profile_active_roles ar
  where ar.pharmacie_id is not null
) pharmacy_accounts
on conflict(profile_id) do nothing;

insert into public.naxa_professional_account_domains(profile_id,domain_code)
select distinct pm.user_id,'PARAPHARMACIE'
from public.partner_members pm
join public.partners pa on pa.id=pm.partner_id
where pa.partner_type='parapharmacie'
on conflict(profile_id) do nothing;

create or replace function private.naxa_guard_profile_professional_domain()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if new.role::text in ('pharmacie','caisse') then
    perform private.naxa_ensure_professional_account_domain(new.id,'PHARMACIE');
  end if;
  return new;
end;
$function$;

drop trigger if exists naxa_profile_professional_domain_guard on public.profiles;
create trigger naxa_profile_professional_domain_guard
before insert or update of role on public.profiles
for each row execute function private.naxa_guard_profile_professional_domain();

create or replace function private.naxa_guard_pharmacy_assignment_domain()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  perform private.naxa_ensure_professional_account_domain(new.profile_id,'PHARMACIE');
  return new;
end;
$function$;

drop trigger if exists naxa_pharmacy_assignment_domain_guard on public.naxa_professional_assignments;
create trigger naxa_pharmacy_assignment_domain_guard
before insert or update of profile_id,pharmacie_id on public.naxa_professional_assignments
for each row execute function private.naxa_guard_pharmacy_assignment_domain();

create or replace function private.naxa_guard_promoteur_pharmacy_domain()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if new.actif is distinct from false then
    perform private.naxa_ensure_professional_account_domain(new.promoteur_id,'PHARMACIE');
  end if;
  return new;
end;
$function$;

drop trigger if exists naxa_promoteur_pharmacy_domain_guard on public.promoteur_pharmacies;
create trigger naxa_promoteur_pharmacy_domain_guard
before insert or update of promoteur_id,actif on public.promoteur_pharmacies
for each row execute function private.naxa_guard_promoteur_pharmacy_domain();

create or replace function private.naxa_guard_partner_member_domain()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_type text;
begin
  select partner_type into v_type
  from public.partners where id=new.partner_id;
  if v_type='parapharmacie' then
    perform private.naxa_ensure_professional_account_domain(new.user_id,'PARAPHARMACIE');
  end if;
  return new;
end;
$function$;

drop trigger if exists naxa_partner_member_domain_guard on public.partner_members;
create trigger naxa_partner_member_domain_guard
before insert or update of partner_id,user_id on public.partner_members
for each row execute function private.naxa_guard_partner_member_domain();

-- 2. Architecture partenaire : projection de la décision Admin du dossier.
create table if not exists public.naxa_partner_architectures (
  partner_id uuid primary key references public.partners(id) on delete restrict,
  architecture_code text not null check (
    architecture_code in ('ORPHELIN','PARENTS_ENFANTS','PARENTS_AINES_CADETS','HYBRIDE')
  ),
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  active boolean not null default false,
  max_responsables integer not null default 0 check (max_responsables>=0),
  max_caisses integer check (max_caisses is null or max_caisses>=0)
);
alter table public.naxa_partner_architectures enable row level security;
revoke all on public.naxa_partner_architectures from public,anon;
grant select on public.naxa_partner_architectures to authenticated;
drop policy if exists naxa_partner_architectures_member_read on public.naxa_partner_architectures;
create policy naxa_partner_architectures_member_read
on public.naxa_partner_architectures for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.partner_members pm
    where pm.partner_id=naxa_partner_architectures.partner_id
      and pm.user_id=(select auth.uid())
  )
);

create or replace function private.naxa_sync_partner_architecture_from_dossier()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_status text;
begin
  if new.universe_slug<>'parapharmacie' or new.architecture_code is null then
    return new;
  end if;
  select status into v_status from public.partners where id=new.partner_id;
  insert into public.naxa_partner_architectures(
    partner_id,architecture_code,assigned_by,active,max_responsables,max_caisses
  ) values (
    new.partner_id,new.architecture_code,null,coalesce(v_status='active',false),
    case when new.architecture_code in ('PARENTS_AINES_CADETS','HYBRIDE') then 1 else 0 end,
    null
  )
  on conflict(partner_id) do update set
    architecture_code=excluded.architecture_code,
    active=excluded.active,
    assigned_at=now(),
    max_responsables=excluded.max_responsables;
  return new;
end;
$function$;

drop trigger if exists naxa_partner_dossier_architecture_sync on public.admin_partner_dossiers;
create trigger naxa_partner_dossier_architecture_sync
after insert or update of universe_slug,architecture_code on public.admin_partner_dossiers
for each row execute function private.naxa_sync_partner_architecture_from_dossier();

insert into public.naxa_partner_architectures(
  partner_id,architecture_code,active,max_responsables,max_caisses
)
select d.partner_id,d.architecture_code,(pa.status='active'),
  case when d.architecture_code in ('PARENTS_AINES_CADETS','HYBRIDE') then 1 else 0 end,
  null
from public.admin_partner_dossiers d
join public.partners pa on pa.id=d.partner_id and pa.partner_type='parapharmacie'
where d.universe_slug='parapharmacie'
  and d.architecture_code in ('ORPHELIN','PARENTS_ENFANTS','PARENTS_AINES_CADETS','HYBRIDE')
on conflict(partner_id) do update set
  architecture_code=excluded.architecture_code,
  active=excluded.active,
  max_responsables=excluded.max_responsables;

create or replace function private.naxa_sync_partner_architecture_status()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if new.partner_type='parapharmacie' then
    update public.naxa_partner_architectures
    set active=(new.status='active')
    where partner_id=new.id;
    if new.status='active' then
      perform private.naxa_sync_partner_owner_privileges(new.id);
    end if;
  end if;
  return new;
end;
$function$;

-- 3. Les affectations utilisent les codes de rôles canoniques NAXA,
-- mais sont physiquement séparées des affectations Pharmacie.
create table if not exists public.naxa_partner_professional_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  partner_id uuid not null references public.partners(id) on delete restrict,
  fonction text not null,
  role_code text not null references public.naxa_roles(code) on delete restrict,
  statut text not null default 'active' check (statut in ('active','revoked')),
  nature_affectation text not null default 'ordinaire'
    check (nature_affectation in ('ordinaire','urgence')),
  motif text not null check (length(trim(motif)) between 5 and 500),
  commence_at timestamptz not null,
  expire_at timestamptz,
  accorde_par uuid not null references public.profiles(id) on delete restrict,
  accorde_at timestamptz not null default now(),
  revoque_par uuid references public.profiles(id) on delete restrict,
  revoque_at timestamptz,
  motif_revocation text,
  created_at timestamptz not null default now(),
  constraint naxa_partner_assignment_role_alias_ck check (fonction=role_code),
  constraint naxa_partner_assignment_period_ck check (
    (nature_affectation='ordinaire' and expire_at is null)
    or (nature_affectation='urgence' and expire_at is not null and expire_at>commence_at)
  ),
  constraint naxa_partner_assignment_revocation_ck check (
    (statut='active' and revoque_par is null and revoque_at is null)
    or (statut='revoked' and revoque_par is not null and revoque_at is not null)
  )
);
create index if not exists naxa_partner_assignments_profile_active_idx
on public.naxa_partner_professional_assignments(profile_id,partner_id,role_code,expire_at)
where statut='active';
create index if not exists naxa_partner_assignments_partner_idx
on public.naxa_partner_professional_assignments(partner_id,statut,expire_at);

alter table public.naxa_partner_professional_assignments enable row level security;
revoke all on public.naxa_partner_professional_assignments from public,anon;
grant select on public.naxa_partner_professional_assignments to authenticated;
drop policy if exists naxa_partner_assignments_participant_read on public.naxa_partner_professional_assignments;
create policy naxa_partner_assignments_participant_read
on public.naxa_partner_professional_assignments for select to authenticated
using (
  profile_id=(select auth.uid())
  or accorde_par=(select auth.uid())
  or revoque_par=(select auth.uid())
  or public.is_admin()
  or (
    private.naxa_partner_scope_allows((select auth.uid()),partner_id,'PARTENAIRE')
    and private.naxa_has_partner_privilege('VIEW_TEAM',partner_id)
  )
);

-- Le registre reste unique par profil : un seul poste/espace sélectionné.
alter table public.naxa_profile_active_roles
  add column if not exists partner_id uuid references public.partners(id) on delete restrict;
alter table public.naxa_profile_active_roles
  drop constraint if exists naxa_profile_active_roles_scope_ck;
alter table public.naxa_profile_active_roles
  add constraint naxa_profile_active_roles_scope_ck check (
    (
      role_code in ('admin','client')
      and pharmacie_id is null and partner_id is null
    )
    or (
      role_code='promoteur'
      and pharmacie_id is null
    )
    or (
      role_code in ('pharmacie','caisse')
      and pharmacie_id is not null and partner_id is null
    )
    or (
      role_code not in ('admin','client','promoteur','pharmacie','caisse')
      and ((pharmacie_id is not null and partner_id is null)
        or (pharmacie_id is null and partner_id is not null))
    )
  );
create index if not exists naxa_profile_active_roles_partner_idx
on public.naxa_profile_active_roles(partner_id,role_code)
where partner_id is not null;

-- Les délégations gardent les mêmes codes de privilège et la même matrice
-- d'architecture, avec une colonne de scope indépendante.
alter table public.naxa_profile_privileges
  add column if not exists partner_id uuid references public.partners(id) on delete cascade;
alter table public.naxa_profile_privileges
  drop constraint if exists naxa_profile_privileges_scope_type_check;
alter table public.naxa_profile_privileges
  add constraint naxa_profile_privileges_scope_type_check
  check (scope_type in ('RESEAU','PHARMACIE','POSTE_CAISSE','PARTENAIRE'));
alter table public.naxa_profile_privileges
  add constraint naxa_profile_privileges_partner_scope_ck check (
    (scope_type='PARTENAIRE' and partner_id is not null and pharmacie_id is null)
    or (scope_type<>'PARTENAIRE' and partner_id is null)
  );
create unique index if not exists naxa_profile_privileges_partner_scope_uidx
on public.naxa_profile_privileges(profile_id,privilege_code,partner_id,scope_type)
where partner_id is not null;

-- 4. Domaines, rôles actifs et privilèges : helpers communs sécurisés.
create or replace function private.naxa_partner_business_function(p_profile uuid)
returns text
language sql
stable
security definer
set search_path=''
as $function$
  select ar.role_code
  from public.naxa_profile_active_roles ar
  join public.profiles p on p.id=ar.profile_id and p.actif=true
  join public.naxa_professional_account_domains d
    on d.profile_id=p.id and d.domain_code='PARAPHARMACIE'
  join public.partners pa
    on pa.id=ar.partner_id and pa.partner_type='parapharmacie' and pa.status='active'
  join public.naxa_partner_architectures aa
    on aa.partner_id=pa.id and aa.active=true
  where ar.profile_id=p_profile
    and ar.partner_id is not null
    and ar.pharmacie_id is null
    and (
      (
        ar.role_code='promoteur'
        and exists (
          select 1 from public.partner_members pm
          where pm.partner_id=pa.id and pm.user_id=p.id and pm.member_role='owner'
        )
      )
      or exists (
        select 1 from public.naxa_partner_professional_assignments a
        where a.profile_id=p.id and a.partner_id=pa.id
          and a.role_code=ar.role_code and a.statut='active'
          and a.commence_at<=now()
          and (a.expire_at is null or a.expire_at>now())
      )
    )
  limit 1
$function$;

create or replace function public.naxa_business_function(p_profile uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path=''
as $function$
  select coalesce(
    private.naxa_partner_business_function(p_profile),
    private.naxa_business_function(p_profile)
  )
$function$;
revoke all on function public.naxa_business_function(uuid) from public,anon;
grant execute on function public.naxa_business_function(uuid) to authenticated,service_role;

create or replace function private.naxa_partner_scope_allows(
  p_profile uuid,
  p_partner uuid,
  p_scope text default 'PARTENAIRE'
) returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select case
    when p_profile is null or p_partner is null or p_scope<>'PARTENAIRE' then false
    when p_profile=(select auth.uid()) and public.is_admin() then true
    else exists (
      select 1
      from public.naxa_profile_active_roles ar
      join public.partners pa on pa.id=ar.partner_id
        and pa.id=p_partner and pa.partner_type='parapharmacie' and pa.status='active'
      join public.naxa_professional_account_domains d
        on d.profile_id=ar.profile_id and d.domain_code='PARAPHARMACIE'
      where ar.profile_id=p_profile
        and ar.partner_id=p_partner
        and ar.pharmacie_id is null
        and ar.role_code=private.naxa_partner_business_function(p_profile)
    )
  end
$function$;

create or replace function private.naxa_has_partner_privilege(
  p_privilege text,
  p_partner uuid
) returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select case
    when auth.uid() is null or p_privilege is null or p_partner is null then false
    when public.is_admin() then true
    else exists (
      select 1
      from public.naxa_partner_architectures aa
      join public.naxa_profile_active_roles ar
        on ar.profile_id=auth.uid() and ar.partner_id=aa.partner_id
      join public.naxa_architecture_privileges ap
        on ap.architecture_code=aa.architecture_code
        and ap.role_key=private.naxa_partner_business_function(auth.uid())
        and ap.privilege_code=p_privilege
      join public.naxa_profile_privileges pp
        on pp.profile_id=auth.uid()
        and pp.partner_id=aa.partner_id
        and pp.scope_type='PARTENAIRE'
        and pp.privilege_code=p_privilege
        and pp.active=true
        and pp.revoked_at is null
      where aa.partner_id=p_partner and aa.active=true
        and ar.role_code=private.naxa_partner_business_function(auth.uid())
    )
  end
$function$;

create or replace function public.naxa_can_partner(
  p_privilege text,
  p_partner_id uuid
) returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select auth.uid() is not null
    and private.naxa_partner_scope_allows(auth.uid(),p_partner_id,'PARTENAIRE')
    and private.naxa_has_partner_privilege(p_privilege,p_partner_id)
$function$;

create or replace function public.naxa_active_role_partner(p_profile uuid default auth.uid())
returns uuid
language sql
stable
security definer
set search_path=''
as $function$
  select case when p_profile=(select auth.uid())
    and private.naxa_partner_business_function(p_profile) is not null
    then ar.partner_id else null end
  from public.naxa_profile_active_roles ar
  where ar.profile_id=p_profile and ar.partner_id is not null
  limit 1
$function$;

create or replace function private.naxa_partner_actor_can(
  p_partner uuid,
  p_privilege text
) returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select case
    when auth.uid() is null or p_partner is null then false
    when public.is_admin() then true
    when exists (
      select 1 from public.partners pa
      where pa.id=p_partner and pa.status='active' and pa.partner_type='parapharmacie'
    ) then private.naxa_partner_scope_allows(auth.uid(),p_partner,'PARTENAIRE')
      and private.naxa_has_partner_privilege(p_privilege,p_partner)
    else exists (
      select 1 from public.partner_members pm
      join public.partners pa on pa.id=pm.partner_id and pa.status='active'
      where pm.partner_id=p_partner and pm.user_id=auth.uid()
        and pm.member_role in ('owner','manager','operator')
    )
  end
$function$;

revoke all on function public.naxa_can_partner(text,uuid) from public,anon;
grant execute on function public.naxa_can_partner(text,uuid) to authenticated,service_role;
revoke all on function public.naxa_active_role_partner(uuid) from public,anon;
grant execute on function public.naxa_active_role_partner(uuid) to authenticated,service_role;

-- Promotion du propriétaire Parapharmacie : seules les lignes prévues par
-- la matrice de l'architecture sont initialisées, sans privilège de gouvernance NAXA.
create or replace function private.naxa_sync_partner_owner_privileges(p_partner uuid)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_owner uuid;
  v_arch text;
begin
  select d.promoteur_id,aa.architecture_code
  into v_owner,v_arch
  from public.admin_partner_dossiers d
  join public.naxa_partner_architectures aa on aa.partner_id=d.partner_id and aa.active=true
  join public.partners pa on pa.id=d.partner_id and pa.status='active'
  where d.partner_id=p_partner and d.universe_slug='parapharmacie'
  order by d.created_at desc
  limit 1;

  if v_owner is null or v_arch is null then return; end if;
  perform private.naxa_ensure_professional_account_domain(v_owner,'PARAPHARMACIE');

  insert into public.naxa_profile_privileges(
    profile_id,privilege_code,pharmacie_id,partner_id,scope_type,granted_by,active
  )
  select v_owner,ap.privilege_code,null,p_partner,'PARTENAIRE',null,true
  from public.naxa_architecture_privileges ap
  join public.naxa_privileges np on np.code=ap.privilege_code
  where ap.architecture_code=v_arch
    and ap.role_key='promoteur'
    and np.governance_only=false
  on conflict (profile_id,privilege_code,partner_id,scope_type)
    where partner_id is not null
  do nothing;
end;
$function$;
revoke all on function private.naxa_sync_partner_owner_privileges(uuid) from public,anon,authenticated;

create or replace function private.naxa_sync_partner_architecture_status()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if new.partner_type='parapharmacie' then
    update public.naxa_partner_architectures
    set active=(new.status='active')
    where partner_id=new.id;
    if new.status='active' then
      perform private.naxa_sync_partner_owner_privileges(new.id);
    end if;
  end if;
  return new;
end;
$function$;
drop trigger if exists naxa_partner_architecture_status_sync on public.partners;
create trigger naxa_partner_architecture_status_sync
after update of status on public.partners
for each row execute function private.naxa_sync_partner_architecture_status();

-- Attribution des privilèges promoteur si le dossier est créé après l'activation
-- ou si l'architecture est mise à jour sur un établissement déjà actif.
create or replace function private.naxa_sync_partner_owner_privileges_from_dossier()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if new.universe_slug='parapharmacie' then
    perform private.naxa_sync_partner_owner_privileges(new.partner_id);
  end if;
  return new;
end;
$function$;
drop trigger if exists naxa_partner_owner_privileges_sync on public.admin_partner_dossiers;
create trigger naxa_partner_owner_privileges_sync
after insert or update of universe_slug,architecture_code,promoteur_id on public.admin_partner_dossiers
for each row execute function private.naxa_sync_partner_owner_privileges_from_dossier();

-- 5. Synchronisation du poste actif pour les affectations du domaine Parapharmacie.
create or replace function private.naxa_sync_partner_active_role()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_selected public.naxa_profile_active_roles%rowtype;
  v_next public.naxa_partner_professional_assignments%rowtype;
  v_owner_partner uuid;
begin
  if tg_op<>'DELETE'
    and new.statut='active'
    and new.commence_at<=now()
    and (new.expire_at is null or new.expire_at>now())
    and exists(select 1 from public.profiles p where p.id=new.profile_id and p.actif=true)
    and exists(select 1 from public.partners pa where pa.id=new.partner_id and pa.status='active') then

    select * into v_selected
    from public.naxa_profile_active_roles ar
    where ar.profile_id=new.profile_id
    limit 1;

    if found and private.naxa_partner_business_function(new.profile_id) is not null then
      return new;
    end if;

    insert into public.naxa_profile_active_roles(
      profile_id,role_code,pharmacie_id,partner_id,selected_at,updated_at
    ) values(new.profile_id,new.role_code,null,new.partner_id,now(),now())
    on conflict(profile_id) do update set
      role_code=excluded.role_code,
      pharmacie_id=null,
      partner_id=excluded.partner_id,
      selected_at=now(),
      updated_at=now();

    update public.profiles
    set fonction_interne=new.role_code
    where id=new.profile_id;

  elsif tg_op='UPDATE'
    and old.statut='active'
    and (new.statut<>'active' or new.commence_at>now()
      or (new.expire_at is not null and new.expire_at<=now())) then

    if exists (
      select 1 from public.naxa_profile_active_roles ar
      where ar.profile_id=old.profile_id
        and ar.partner_id=old.partner_id
        and ar.role_code=old.role_code
    ) then
      select a.* into v_next
      from public.naxa_partner_professional_assignments a
      join public.partners pa on pa.id=a.partner_id and pa.status='active'
      join public.profiles p on p.id=a.profile_id and p.actif=true
      where a.profile_id=old.profile_id
        and a.id<>new.id
        and a.statut='active'
        and a.commence_at<=now()
        and (a.expire_at is null or a.expire_at>now())
      order by a.accorde_at desc,a.created_at desc
      limit 1;

      if found then
        update public.naxa_profile_active_roles
        set role_code=v_next.role_code,pharmacie_id=null,partner_id=v_next.partner_id,
            selected_at=now(),updated_at=now()
        where profile_id=old.profile_id;
        update public.profiles set fonction_interne=v_next.role_code
        where id=old.profile_id;
      else
        select pm.partner_id into v_owner_partner
        from public.partner_members pm
        join public.partners pa on pa.id=pm.partner_id and pa.status='active'
        where pm.user_id=old.profile_id and pm.member_role='owner'
          and pa.partner_type='parapharmacie'
        order by pa.created_at desc
        limit 1;
        if v_owner_partner is not null then
          update public.naxa_profile_active_roles
          set role_code='promoteur',pharmacie_id=null,partner_id=v_owner_partner,
              selected_at=now(),updated_at=now()
          where profile_id=old.profile_id;
          update public.profiles set fonction_interne=null
          where id=old.profile_id;
        else
          delete from public.naxa_profile_active_roles
          where profile_id=old.profile_id and partner_id is not null;
          update public.profiles set fonction_interne=null
          where id=old.profile_id;
        end if;
      end if;
    end if;
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$function$;

create or replace function private.naxa_validate_partner_professional_assignment()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if new.role_code is null then new.role_code:=new.fonction; end if;
  if new.fonction is null then new.fonction:=new.role_code; end if;
  if new.role_code is distinct from new.fonction then
    raise exception 'Le rôle canonique et son alias doivent être identiques';
  end if;
  if not exists (
    select 1 from public.naxa_roles r
    where r.code=new.role_code and r.actif=true and r.assignable=true
    and r.categorie='PROFESSIONNEL'
  ) then
    raise exception 'Rôle professionnel NAXA inconnu ou non attribuable';
  end if;
  if not exists (
    select 1 from public.partners pa
    where pa.id=new.partner_id and pa.partner_type='parapharmacie'
      and pa.status='active'
  ) then
    raise exception 'Établissement Parapharmacie inactif ou introuvable';
  end if;
  perform private.naxa_ensure_professional_account_domain(new.profile_id,'PARAPHARMACIE');
  return new;
end;
$function$;

drop trigger if exists naxa_partner_assignment_validate on public.naxa_partner_professional_assignments;
create trigger naxa_partner_assignment_validate
before insert or update on public.naxa_partner_professional_assignments
for each row execute function private.naxa_validate_partner_professional_assignment();

drop trigger if exists naxa_partner_assignment_active_role_sync on public.naxa_partner_professional_assignments;
create trigger naxa_partner_assignment_active_role_sync
after insert or update on public.naxa_partner_professional_assignments
for each row execute function private.naxa_sync_partner_active_role();

-- 6. Sélection unique du rôle actif : ancienne signature conservée pour Pharmacie,
-- nouvelle signature à trois paramètres pour inclure le périmètre Parapharmacie.
create or replace function public.naxa_select_active_role(
  p_role_code text,
  p_pharmacie_id uuid,
  p_partner_id uuid
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_profile public.profiles%rowtype;
  v_role public.naxa_roles%rowtype;
  v_allowed boolean:=false;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select * into v_profile from public.profiles
  where id=v_uid and actif=true for update;
  if not found then raise exception 'Profil actif introuvable'; end if;

  if p_role_code is null then
    if p_pharmacie_id is not null or p_partner_id is not null then
      raise exception 'Un rôle nul ne peut porter aucun périmètre';
    end if;
    delete from public.naxa_profile_active_roles where profile_id=v_uid;
    update public.profiles
    set fonction_interne=null,
        pharmacie_id=case when v_profile.role::text in ('pharmacie','caisse')
          then v_profile.pharmacie_id else null end
    where id=v_uid;
    return true;
  end if;

  if p_pharmacie_id is not null and p_partner_id is not null then
    raise exception 'Un poste ne peut pas être partagé entre Pharmacie et Parapharmacie';
  end if;

  select * into v_role from public.naxa_roles
  where code=p_role_code and actif=true;
  if not found then raise exception 'Rôle inconnu ou inactif'; end if;

  if p_partner_id is not null then
    if not exists (
      select 1 from public.partners pa
      join public.naxa_partner_architectures aa on aa.partner_id=pa.id and aa.active=true
      join public.naxa_professional_account_domains d
        on d.profile_id=v_uid and d.domain_code='PARAPHARMACIE'
      where pa.id=p_partner_id and pa.partner_type='parapharmacie' and pa.status='active'
    ) then raise exception 'Établissement Parapharmacie hors périmètre ou inactif'; end if;

    if p_role_code='promoteur' then
      v_allowed:=exists (
        select 1 from public.partner_members pm
        where pm.partner_id=p_partner_id and pm.user_id=v_uid and pm.member_role='owner'
      );
    else
      v_allowed:=exists (
        select 1 from public.naxa_partner_professional_assignments a
        where a.profile_id=v_uid and a.partner_id=p_partner_id
          and a.role_code=p_role_code and a.statut='active'
          and a.commence_at<=now()
          and (a.expire_at is null or a.expire_at>now())
      );
    end if;
  elsif p_role_code in ('admin','client','promoteur') then
    v_allowed:=v_profile.role::text=p_role_code;
    if p_role_code='promoteur' then
      v_allowed:=v_allowed and private.naxa_promoteur_valide(v_uid);
    end if;
    if p_pharmacie_id is not null then v_allowed:=false; end if;
  elsif p_role_code in ('pharmacie','caisse') then
    v_allowed:=p_pharmacie_id is not null
      and v_profile.role::text=p_role_code
      and p_pharmacie_id=v_profile.pharmacie_id
      and exists(select 1 from public.pharmacies ph
        where ph.id=p_pharmacie_id and ph.actif=true);
  else
    v_allowed:=p_pharmacie_id is not null and exists (
      select 1 from public.naxa_professional_assignments a
      join public.pharmacies ph on ph.id=a.pharmacie_id and ph.actif=true
      where a.profile_id=v_uid and a.role_code=p_role_code
        and a.pharmacie_id=p_pharmacie_id and a.statut='active'
        and a.commence_at<=now()
        and (
          a.expire_at is null or a.expire_at>now()
          or (
            p_role_code='livreur'
            and exists(select 1 from public.naxa_delivery_missions m
              where m.livreur_id=v_uid and m.pharmacie_id=p_pharmacie_id
                and m.statut in ('accepted','picked_up','arrived'))
          )
        )
    );
  end if;

  if not v_allowed then raise exception 'Ce rôle n’est pas attribué à ce compte pour ce périmètre'; end if;

  insert into public.naxa_profile_active_roles(
    profile_id,role_code,pharmacie_id,partner_id,selected_at,updated_at
  ) values(v_uid,p_role_code,p_pharmacie_id,p_partner_id,now(),now())
  on conflict(profile_id) do update set
    role_code=excluded.role_code,
    pharmacie_id=excluded.pharmacie_id,
    partner_id=excluded.partner_id,
    selected_at=now(),
    updated_at=now();

  update public.profiles
  set fonction_interne=case
        when p_role_code in ('admin','client','pharmacie','promoteur') then null
        else p_role_code
      end,
      pharmacie_id=case
        when p_partner_id is not null then v_profile.pharmacie_id
        when p_role_code in ('admin','client','promoteur') then null
        when p_role_code in ('pharmacie','caisse') then v_profile.pharmacie_id
        else p_pharmacie_id
      end
  where id=v_uid;
  return true;
end;
$function$;

revoke all on function public.naxa_select_active_role(text,uuid,uuid) from public,anon;
grant execute on function public.naxa_select_active_role(text,uuid,uuid) to authenticated,service_role;

create or replace function public.naxa_select_active_role(
  p_role_code text,
  p_pharmacie_id uuid default null
) returns boolean
language sql
security definer
set search_path=''
as $function$
  select public.naxa_select_active_role(p_role_code,p_pharmacie_id,null::uuid)
$function$;
revoke all on function public.naxa_select_active_role(text,uuid) from public,anon;
grant execute on function public.naxa_select_active_role(text,uuid) to authenticated,service_role;

-- 7. Attribution et révocation : règles identiques aux affectations Pharmacie,
-- appliquées au partenaire et au compte professionnel Parapharmacie.
create or replace function public.naxa_grant_partner_professional_assignment(
  p_target uuid,
  p_partner_id uuid,
  p_fonction text,
  p_commence_at timestamptz,
  p_expire_at timestamptz,
  p_motif text
) returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_actor_role text;
  v_arch text;
  v_max_caisses integer;
  v_count integer;
  v_required_privilege text;
  v_nature text;
  v_id uuid;
begin
  if v_actor is null then raise exception 'Connexion requise'; end if;
  if p_target is null or p_partner_id is null or p_target=v_actor then
    raise exception 'Cible ou partenaire invalide';
  end if;
  if not exists (
    select 1 from public.naxa_roles r
    where r.code=p_fonction and r.actif and r.assignable
      and r.categorie='PROFESSIONNEL'
  ) then raise exception 'Rôle professionnel non attribuable'; end if;
  if p_commence_at is null or p_commence_at>now()+interval '1 minute'
    or (p_expire_at is not null and p_expire_at<=greatest(p_commence_at,now())) then
    raise exception 'Période d’affectation invalide';
  end if;
  if p_motif is null or length(trim(p_motif))<5 or length(trim(p_motif))>500 then
    raise exception 'Motif obligatoire (5 à 500 caractères)';
  end if;
  if not exists(select 1 from public.profiles p where p.id=p_target and p.actif=true) then
    raise exception 'Le compte cible doit être actif';
  end if;

  select architecture_code,max_caisses into v_arch,v_max_caisses
  from public.naxa_partner_architectures
  where partner_id=p_partner_id and active=true;
  if v_arch is null or not exists (
    select 1 from public.partners pa
    where pa.id=p_partner_id and pa.partner_type='parapharmacie' and pa.status='active'
  ) then raise exception 'Architecture Parapharmacie absente ou inactive'; end if;

  if p_fonction='responsable' and v_arch not in ('PARENTS_AINES_CADETS','HYBRIDE') then
    raise exception 'Cette architecture ne permet pas de Responsable'; end if;
  if p_fonction='caisse' and not exists (
    select 1 from public.naxa_architecture_niveaux
    where architecture_code=v_arch and niveau=3
  ) then raise exception 'Cette architecture ne permet pas de Caisse'; end if;

  v_actor_role:=public.naxa_business_function(v_actor);
  if not public.is_admin() then
    if v_actor_role not in ('promoteur','responsable')
      or not private.naxa_partner_scope_allows(v_actor,p_partner_id,'PARTENAIRE') then
      raise exception 'Affectation réservée au Promoteur ou Responsable autorisé de cette Parapharmacie';
    end if;
    if v_actor_role='promoteur' then
      if not exists(select 1 from public.partner_members pm
        where pm.partner_id=p_partner_id and pm.user_id=v_actor and pm.member_role='owner') then
        raise exception 'Seul le Promoteur titulaire peut gérer cette équipe';
      end if;
    elsif v_actor_role='responsable' then
      if p_fonction<>'caisse' then
        raise exception 'Le Responsable ne peut affecter que la Caisse';
      end if;
    end if;
  end if;

  v_required_privilege:=case
    when p_fonction='caisse' then 'CREATE_CAISSE'
    when p_fonction='responsable' then 'CREATE_RESPONSABLE'
    else 'ASSIGN_USER_TO_PHARMACY'
  end;
  if not public.is_admin() and not private.naxa_has_partner_privilege(v_required_privilege,p_partner_id) then
    raise exception 'Privilège % absent pour cette Parapharmacie',v_required_privilege;
  end if;

  perform private.naxa_ensure_professional_account_domain(p_target,'PARAPHARMACIE');
  if exists (
    select 1 from public.partner_members pm
    where pm.partner_id=p_partner_id and pm.user_id=p_target and pm.member_role='owner'
  ) then raise exception 'Le Promoteur titulaire ne peut pas être affecté comme membre'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_target::text||':'||p_partner_id::text||':'||p_fonction,0
  ));
  if exists (
    select 1 from public.naxa_partner_professional_assignments a
    where a.profile_id=p_target and a.partner_id=p_partner_id
      and a.role_code=p_fonction and a.statut='active'
      and (a.expire_at is null or a.expire_at>p_commence_at)
      and (p_expire_at is null or a.commence_at<p_expire_at)
  ) then raise exception 'Une affectation active de ce rôle chevauche déjà la période'; end if;

  if p_fonction='caisse' and v_max_caisses is not null then
    perform pg_advisory_xact_lock(hashtextextended('naxa-partner-caisse-quota:'||p_partner_id::text,0));
    select count(*) into v_count
    from public.naxa_partner_professional_assignments a
    join public.profiles p on p.id=a.profile_id and p.actif=true
    where a.partner_id=p_partner_id and a.role_code='caisse'
      and a.statut='active' and a.commence_at<=now()
      and (a.expire_at is null or a.expire_at>now())
      and a.profile_id<>p_target;
    if v_count>=v_max_caisses then raise exception 'Quota Caisses atteint'; end if;
  end if;

  insert into public.partner_members(partner_id,user_id,member_role)
  values(p_partner_id,p_target,'viewer')
  on conflict(partner_id,user_id) do nothing;

  v_nature:=case when p_expire_at is null then 'ordinaire' else 'urgence' end;
  insert into public.naxa_partner_professional_assignments(
    profile_id,partner_id,fonction,role_code,statut,nature_affectation,motif,
    commence_at,expire_at,accorde_par
  ) values(
    p_target,p_partner_id,p_fonction,p_fonction,'active',v_nature,trim(p_motif),
    p_commence_at,p_expire_at,v_actor
  ) returning id into v_id;
  return v_id;
end;
$function$;
revoke all on function public.naxa_grant_partner_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.naxa_grant_partner_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text) to authenticated,service_role;

create or replace function public.naxa_revoke_partner_professional_assignment(
  p_assignment uuid,
  p_motif text
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_assignment public.naxa_partner_professional_assignments%rowtype;
begin
  if v_actor is null then raise exception 'Connexion requise'; end if;
  if p_motif is null or length(trim(p_motif))<5 or length(trim(p_motif))>500 then
    raise exception 'Motif de révocation obligatoire';
  end if;
  select * into v_assignment
  from public.naxa_partner_professional_assignments
  where id=p_assignment and statut='active'
  for update;
  if not found then raise exception 'Affectation active introuvable'; end if;

  if not public.is_admin() then
    if not private.naxa_partner_scope_allows(v_actor,v_assignment.partner_id,'PARTENAIRE')
      or public.naxa_business_function(v_actor)<>'promoteur'
      or not exists(select 1 from public.partner_members pm
        where pm.partner_id=v_assignment.partner_id and pm.user_id=v_actor and pm.member_role='owner')
      or not private.naxa_has_partner_privilege('REMOVE_USER_FROM_PHARMACY',v_assignment.partner_id) then
      raise exception 'Révocation hors périmètre ou privilège absent';
    end if;
  end if;

  update public.naxa_partner_professional_assignments
  set statut='revoked',revoque_par=v_actor,revoque_at=now(),motif_revocation=trim(p_motif)
  where id=p_assignment;
  return true;
end;
$function$;
revoke all on function public.naxa_revoke_partner_professional_assignment(uuid,text) from public,anon;
grant execute on function public.naxa_revoke_partner_professional_assignment(uuid,text) to authenticated,service_role;

create or replace function public.naxa_grant_partner_privilege(
  p_target uuid,
  p_partner_id uuid,
  p_privilege text
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_arch text;
  v_role text;
begin
  if v_actor is null then raise exception 'Connexion requise'; end if;
  if not public.is_admin() then
    if public.naxa_business_function(v_actor)<>'promoteur'
      or not private.naxa_partner_scope_allows(v_actor,p_partner_id,'PARTENAIRE')
      or not exists(select 1 from public.partner_members pm
        where pm.partner_id=p_partner_id and pm.user_id=v_actor and pm.member_role='owner')
      or not private.naxa_has_partner_privilege('ASSIGN_PRIVILEGE',p_partner_id) then
      raise exception 'Délégation réservée au Promoteur titulaire autorisé';
    end if;
  end if;
  select a.architecture_code into v_arch
  from public.naxa_partner_architectures a
  where a.partner_id=p_partner_id and a.active=true;
  select a.role_code into v_role
  from public.naxa_partner_professional_assignments a
  where a.profile_id=p_target and a.partner_id=p_partner_id
    and a.statut='active' and a.commence_at<=now()
    and (a.expire_at is null or a.expire_at>now())
  order by a.accorde_at desc limit 1;
  if v_arch is null or v_role is null then raise exception 'Affectation professionnelle active introuvable'; end if;
  if not exists (
    select 1 from public.naxa_architecture_privileges ap
    join public.naxa_privileges np on np.code=ap.privilege_code
    where ap.architecture_code=v_arch and ap.role_key=v_role
      and ap.privilege_code=p_privilege and np.delegable=true
      and np.governance_only=false
  ) then raise exception 'Privilège hors matrice de l’architecture ou non délégable'; end if;

  insert into public.naxa_profile_privileges(
    profile_id,privilege_code,pharmacie_id,partner_id,scope_type,granted_by,active,revoked_at
  ) values(p_target,p_privilege,null,p_partner_id,'PARTENAIRE',v_actor,true,null)
  on conflict(profile_id,privilege_code,partner_id,scope_type)
    where partner_id is not null
  do update set active=true,revoked_at=null,granted_by=v_actor,granted_at=now();
  return true;
end;
$function$;
revoke all on function public.naxa_grant_partner_privilege(uuid,uuid,text) from public,anon;
grant execute on function public.naxa_grant_partner_privilege(uuid,uuid,text) to authenticated,service_role;

create or replace function public.naxa_revoke_partner_privilege(
  p_target uuid,
  p_partner_id uuid,
  p_privilege text
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
begin
  if v_actor is null then raise exception 'Connexion requise'; end if;
  if not public.is_admin() and (
    public.naxa_business_function(v_actor)<>'promoteur'
    or not private.naxa_partner_scope_allows(v_actor,p_partner_id,'PARTENAIRE')
    or not exists(select 1 from public.partner_members pm
      where pm.partner_id=p_partner_id and pm.user_id=v_actor and pm.member_role='owner')
    or not private.naxa_has_partner_privilege('REVOKE_PRIVILEGE',p_partner_id)
  ) then raise exception 'Révocation du privilège non autorisée'; end if;

  update public.naxa_profile_privileges
  set active=false,revoked_at=now()
  where profile_id=p_target and partner_id=p_partner_id
    and privilege_code=p_privilege and scope_type='PARTENAIRE' and active=true;
  return found;
end;
$function$;
revoke all on function public.naxa_revoke_partner_privilege(uuid,uuid,text) from public,anon;
grant execute on function public.naxa_revoke_partner_privilege(uuid,uuid,text) to authenticated,service_role;

-- 8. RLS et RPC existantes : les partenaires non-Parapharmacie gardent leur
-- modèle actuel ; la Parapharmacie passe obligatoirement par le RBAC professionnel.
create or replace function private.naxa_partner_scope_allows(
  p_profile uuid,
  p_partner uuid,
  p_scope text default 'PARTENAIRE'
) returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select case
    when p_profile is null or p_partner is null or p_scope<>'PARTENAIRE' then false
    when p_profile=(select auth.uid()) and public.is_admin() then true
    else exists (
      select 1 from public.naxa_profile_active_roles ar
      join public.partners pa on pa.id=ar.partner_id and pa.id=p_partner
        and pa.partner_type='parapharmacie' and pa.status='active'
      join public.naxa_professional_account_domains d
        on d.profile_id=ar.profile_id and d.domain_code='PARAPHARMACIE'
      where ar.profile_id=p_profile and ar.partner_id=p_partner
        and ar.pharmacie_id is null
        and ar.role_code=private.naxa_partner_business_function(p_profile)
    )
  end
$function$;

drop policy if exists partner_products_member_manage on public.partner_products;
drop policy if exists partner_products_professional_read on public.partner_products;
drop policy if exists partner_products_professional_insert on public.partner_products;
drop policy if exists partner_products_professional_update on public.partner_products;
drop policy if exists partner_products_legacy_delete on public.partner_products;

create policy partner_products_professional_read
on public.partner_products for select to authenticated
using (
  private.naxa_partner_actor_can(partner_id,'VIEW_PRODUCTS')
  or private.naxa_partner_actor_can(partner_id,'VIEW_STOCK')
);

create policy partner_products_professional_insert
on public.partner_products for insert to authenticated
with check (private.naxa_partner_actor_can(partner_id,'CREATE_PRODUCT'));

create policy partner_products_professional_update
on public.partner_products for update to authenticated
using (
  private.naxa_partner_actor_can(partner_id,'EDIT_PRODUCT')
  or private.naxa_partner_actor_can(partner_id,'ARCHIVE_PRODUCT')
)
with check (
  private.naxa_partner_actor_can(partner_id,'EDIT_PRODUCT')
  or private.naxa_partner_actor_can(partner_id,'ARCHIVE_PRODUCT')
);

create policy partner_products_legacy_delete
on public.partner_products for delete to authenticated
using (
  exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id and pa.status='active'
    where pm.partner_id=partner_products.partner_id
      and pm.user_id=(select auth.uid())
      and pa.partner_type<>'parapharmacie'
      and pm.member_role in ('owner','manager','operator')
  )
);

create or replace function public.get_partner_catalogue_alerts()
returns table(
  product_id uuid,partner_id uuid,universe_slug text,name text,
  stock_quantity numeric,low_stock_threshold numeric,expires_at date,
  low_stock boolean,is_expired boolean,days_until_expiry integer
)
language plpgsql
stable
security definer
set search_path=''
as $function$
declare uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'Connexion requise' using errcode='28000'; end if;
  if not exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id and pa.status='active'
    where pm.user_id=uid
      and (
        (pa.partner_type='parapharmacie' and private.naxa_partner_actor_can(pa.id,'VIEW_STOCK'))
        or (pa.partner_type<>'parapharmacie' and pm.member_role in ('owner','manager','operator'))
      )
  ) and not public.is_admin() then
    raise exception 'Accès partenaire requis' using errcode='42501';
  end if;

  return query
  select pp.id,pp.partner_id,pp.universe_slug,pp.name,pp.stock_quantity,pp.low_stock_threshold,
    pp.expires_at,(pp.stock_quantity<=pp.low_stock_threshold),
    (pp.expires_at<current_date),(pp.expires_at-current_date)::integer
  from public.partner_products pp
  where pp.status<>'archived'
    and pp.universe_slug in ('parapharmacie','bebe-maman')
    and private.naxa_partner_actor_can(pp.partner_id,'VIEW_STOCK')
    and (
      pp.stock_quantity<=pp.low_stock_threshold
      or (pp.expires_at is not null and pp.expires_at<=current_date+30)
    )
  order by pp.expires_at nulls last,pp.name;
end;
$function$;

create or replace function public.partner_adjust_universe_stock(
  p_product_id uuid,p_quantity_delta numeric,p_movement_type text,p_reason text default null
) returns numeric
language plpgsql
security definer
set search_path=''
as $function$
declare
  uid uuid:=auth.uid();
  product_row public.partner_products%rowtype;
  next_quantity numeric(12,3);
  clean_reason text:=left(trim(coalesce(p_reason,'')),240);
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
  select pp.* into product_row from public.partner_products pp
  where pp.id=p_product_id for update;
  if not found then raise exception 'Produit introuvable'; end if;
  if not exists (
    select 1 from public.partners pa
    join public.partner_universes pu on pu.partner_id=pa.id
      and pu.universe_slug=product_row.universe_slug and pu.enabled=true
    where pa.id=product_row.partner_id and pa.status='active'
  ) or not private.naxa_partner_actor_can(product_row.partner_id,'EDIT_STOCK_QUANTITY') then
    raise exception 'Action non autorisée';
  end if;
  next_quantity:=product_row.stock_quantity+p_quantity_delta;
  if next_quantity<0 then raise exception 'Le stock ne peut pas devenir négatif'; end if;
  update public.partner_products set stock_quantity=next_quantity,updated_at=now()
  where id=p_product_id;
  insert into public.stock_movements(
    partner_id,product_id,quantity_delta,movement_type,reason,reference,created_by
  ) values (
    product_row.partner_id,p_product_id,p_quantity_delta,p_movement_type,
    nullif(clean_reason,''),'manual:'||gen_random_uuid()::text,uid
  );
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(uid,'partner_stock.adjusted','partner_product',p_product_id::text,
    jsonb_build_object('delta',p_quantity_delta,'resulting_stock',next_quantity,
      'movement_type',p_movement_type,'reason',nullif(clean_reason,'')));
  return next_quantity;
end;
$function$;

create or replace function public.partner_import_universe_products(
  p_partner_id uuid,p_universe_slug text,p_rows jsonb
) returns integer
language plpgsql
security definer
set search_path=''
as $function$
declare
  uid uuid:=auth.uid();
  row_data jsonb;
  new_product public.partner_products%rowtype;
  qty numeric(12,3);
  inserted_count integer:=0;
  row_count integer;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  if p_universe_slug not in ('parapharmacie','bebe-maman') then raise exception 'Univers invalide'; end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'Import invalide'; end if;
  row_count:=jsonb_array_length(p_rows);
  if row_count<1 or row_count>500 then raise exception 'Limite import invalide'; end if;
  if not exists (
    select 1 from public.partners pa
    join public.partner_universes pu on pu.partner_id=pa.id
      and pu.universe_slug=p_universe_slug and pu.enabled=true
    where pa.id=p_partner_id and pa.status='active'
  ) or not private.naxa_partner_actor_can(p_partner_id,'IMPORT_PRODUCTS') then
    raise exception 'Action non autorisée';
  end if;
  for row_data in select value from jsonb_array_elements(p_rows) loop
    qty:=(row_data->>'stock_quantity')::numeric;
    if length(trim(coalesce(row_data->>'name',''))) not between 2 and 180
      or coalesce((row_data->>'price_fcfa')::integer,-1)<0
      or qty<0 or qty>1000000
      or coalesce((row_data->>'low_stock_threshold')::numeric,3)<0
      or coalesce((row_data->>'low_stock_threshold')::numeric,3)>1000000
      or (nullif(row_data->>'expires_at','') is not null
        and (row_data->>'expires_at')::date is null) then
      raise exception 'Ligne CSV invalide';
    end if;
    insert into public.partner_products(
      partner_id,universe_slug,name,brand,category,description,photo_url,price_fcfa,
      stock_quantity,unit_label,expires_at,low_stock_threshold,status,created_by
    ) values (
      p_partner_id,p_universe_slug,trim(row_data->>'name'),
      nullif(left(row_data->>'brand',120),''),
      coalesce(nullif(left(row_data->>'category',100),''),'Autres'),
      nullif(left(row_data->>'description',600),''),
      nullif(row_data->>'photo_url',''),(row_data->>'price_fcfa')::integer,0,
      coalesce(nullif(left(row_data->>'unit_label',30),''),'unité'),
      nullif(row_data->>'expires_at','')::date,
      coalesce((row_data->>'low_stock_threshold')::numeric,3),'draft',uid
    ) returning * into new_product;
    if qty>0 then
      update public.partner_products set stock_quantity=qty,updated_at=now()
      where id=new_product.id;
      insert into public.stock_movements(
        partner_id,product_id,quantity_delta,movement_type,reason,reference,created_by
      ) values(
        p_partner_id,new_product.id,qty,'opening','Stock initial import CSV',
        'csv-import:'||new_product.id::text,uid
      );
    end if;
    inserted_count:=inserted_count+1;
  end loop;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(uid,'partner.catalogue.csv_import','partner',p_partner_id::text,
    jsonb_build_object('universe',p_universe_slug,'rows',inserted_count));
  return inserted_count;
end;
$function$;

create or replace function public.partner_link_catalogue_photo(
  p_partner_id uuid,p_product_id uuid,p_photo_path text,p_photo_url text,
  p_source_url text,p_licence text
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_universe text;
begin
  if v_user is null then raise exception 'Connexion requise' using errcode='28000'; end if;
  if p_partner_id is null or p_product_id is null or p_photo_path is null
    or p_photo_url is null or p_source_url is null or p_licence is null
    or p_source_url !~* '^https://'
    or length(btrim(p_licence)) not between 5 and 500
    or p_photo_path !~* (
      '^'||p_partner_id::text||'/'||p_product_id::text||
      '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    )
    or p_photo_url !~* '^https://[^/]+/storage/v1/object/public/partner-catalogue-photos/'
    or right(p_photo_url,length(p_photo_path))<>p_photo_path then
    raise exception 'Provenance ou chemin de photo invalide' using errcode='22023';
  end if;

  select pp.universe_slug into v_universe
  from public.partner_products pp
  join public.partners pa on pa.id=pp.partner_id and pa.status='active'
  where pp.id=p_product_id and pp.partner_id=p_partner_id
    and pp.status<>'archived'
    and pp.universe_slug in ('parapharmacie','bebe-maman')
    and private.naxa_partner_actor_can(pp.partner_id,'EDIT_PRODUCT')
    and exists (
      select 1 from public.partner_universes pu
      where pu.partner_id=pp.partner_id and pu.universe_slug=pp.universe_slug
        and pu.enabled is true
    )
  for update of pp;

  if not found then raise exception 'Produit ou partenaire non autorisé' using errcode='42501'; end if;

  insert into public.partner_product_photo_provenance(
    product_id,partner_id,universe_slug,source_url,licence,
    rights_confirmed_at,rights_confirmed_by,uploaded_by,updated_at
  ) values(
    p_product_id,p_partner_id,v_universe,p_source_url,btrim(p_licence),
    now(),v_user,v_user,now()
  )
  on conflict(product_id) do update set
    partner_id=excluded.partner_id,universe_slug=excluded.universe_slug,
    source_url=excluded.source_url,licence=excluded.licence,
    rights_confirmed_at=excluded.rights_confirmed_at,
    rights_confirmed_by=excluded.rights_confirmed_by,
    uploaded_by=excluded.uploaded_by,updated_at=excluded.updated_at;

  update public.partner_products set photo_url=p_photo_url,photo_path=p_photo_path,updated_at=now()
  where id=p_product_id and partner_id=p_partner_id;
  return true;
end;
$function$;

create or replace function public.partner_unlink_catalogue_photo(
  p_partner_id uuid,p_product_id uuid
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Connexion requise' using errcode='28000'; end if;
  if not exists (
    select 1 from public.partner_products pp
    join public.partners pa on pa.id=pp.partner_id and pa.status='active'
    where pp.id=p_product_id and pp.partner_id=p_partner_id
      and private.naxa_partner_actor_can(pp.partner_id,'EDIT_PRODUCT')
  ) then raise exception 'Produit ou partenaire non autorisé' using errcode='42501'; end if;

  delete from public.partner_product_photo_provenance
  where product_id=p_product_id and partner_id=p_partner_id;
  update public.partner_products set photo_url=null,photo_path=null,updated_at=now()
  where id=p_product_id and partner_id=p_partner_id;
  return true;
end;
$function$;

do $patch$
declare
  v_sql text;
  v_old text;
  v_new text;
begin
  v_sql:=pg_get_functiondef('public.transition_universe_reservation(uuid,text)'::regprocedure);
  v_old:=$old$
  select exists(
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
    where pm.partner_id=r.partner_id and pm.user_id=uid
      and pm.member_role in ('owner','manager','operator') and pa.status='active'
  ) into can_manage;
$old$;
  v_new:=$new$
  select private.naxa_partner_actor_can(r.partner_id,'PROCESS_RESERVATION')
    into can_manage;
$new$;
  if position(v_old in v_sql)=0 then
    raise exception 'Contrôle de gestion des réservations partenaire introuvable';
  end if;
  execute replace(v_sql,v_old,v_new);
end;
$patch$;

-- Les fonctions exposées gardent des ACL explicites ; les fonctions privées sont
-- appelées uniquement par leurs enveloppes SECURITY DEFINER/RLS.
revoke all on function public.get_partner_catalogue_alerts() from public,anon;
grant execute on function public.get_partner_catalogue_alerts() to authenticated,service_role;
revoke all on function public.partner_adjust_universe_stock(uuid,numeric,text,text) from public,anon;
grant execute on function public.partner_adjust_universe_stock(uuid,numeric,text,text) to authenticated,service_role;
revoke all on function public.partner_import_universe_products(uuid,text,jsonb) from public,anon;
grant execute on function public.partner_import_universe_products(uuid,text,jsonb) to authenticated,service_role;
revoke all on function public.partner_link_catalogue_photo(uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.partner_link_catalogue_photo(uuid,uuid,text,text,text,text) to authenticated,service_role;
revoke all on function public.partner_unlink_catalogue_photo(uuid,uuid) from public,anon;
grant execute on function public.partner_unlink_catalogue_photo(uuid,uuid) to authenticated,service_role;
revoke all on function public.transition_universe_reservation(uuid,text) from public,anon;
grant execute on function public.transition_universe_reservation(uuid,text) to authenticated,service_role;

commit;
