-- NAXA — Migration 042 : socle canonique manquant / compatibilité de replay
-- Restaure les dépendances exigées par les migrations 043→048 et le moteur de pilotage.
-- Additif uniquement : aucun objet métier existant n'est supprimé.
begin;

create schema if not exists private;

create table if not exists public.promoteur_pharmacies (
  promoteur_id uuid not null references public.profiles(id) on delete cascade,
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (promoteur_id, pharmacie_id)
);
alter table public.promoteur_pharmacies enable row level security;

create table if not exists public.naxa_privileges (
  code text primary key,
  domaine text not null,
  description text not null,
  niveau_min smallint not null,
  niveau_max smallint not null,
  delegable boolean not null default false,
  governance boolean not null default false,
  active boolean not null default true,
  check (niveau_min between 0 and 4),
  check (niveau_max between niveau_min and 4)
);
alter table public.naxa_privileges enable row level security;

create table if not exists public.naxa_architecture_privileges (
  architecture_code text not null,
  role_key text not null,
  privilege_code text not null references public.naxa_privileges(code) on delete cascade,
  active boolean not null default true,
  primary key (architecture_code, role_key, privilege_code)
);
alter table public.naxa_architecture_privileges enable row level security;

create table if not exists public.naxa_profile_privileges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  privilege_code text not null references public.naxa_privileges(code) on delete cascade,
  pharmacie_id uuid references public.pharmacies(id) on delete cascade,
  scope_type text not null check (scope_type in ('RESEAU','PHARMACIE','POSTE_CAISSE')),
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  active boolean not null default true,
  revoked_at timestamptz,
  unique(profile_id, privilege_code, pharmacie_id, scope_type)
);
alter table public.naxa_profile_privileges enable row level security;

insert into public.naxa_privileges(code,domaine,description,niveau_min,niveau_max,delegable,governance)
values
 ('VIEW_NETWORK_PILOTAGE','pilotage','Voir le pilotage réseau autorisé',1,1,true,false),
 ('VIEW_PERFORMANCE_PILOTAGE','pilotage','Voir les KPI de performance du périmètre autorisé',0,3,true,false),
 ('ASSIGN_PRIVILEGE','gouvernance','Attribuer un privilège délégable',1,3,false,true),
 ('REVOKE_PRIVILEGE','gouvernance','Révoquer un privilège',1,3,false,true)
on conflict(code) do update set
 domaine=excluded.domaine,description=excluded.description,niveau_min=excluded.niveau_min,
 niveau_max=excluded.niveau_max,delegable=excluded.delegable,governance=excluded.governance,active=true;

insert into public.naxa_architecture_privileges(architecture_code,role_key,privilege_code)
select a.architecture_code,'promoteur',p.code
from (values ('ORPHELIN'),('PARENTS_ENFANTS'),('PARENTS_AINES_CADETS'),('HYBRIDE')) a(architecture_code)
cross join (values ('VIEW_NETWORK_PILOTAGE'),('VIEW_PERFORMANCE_PILOTAGE')) p(code)
on conflict do nothing;

create or replace function public.naxa_business_function(p_profile uuid)
returns text
language sql stable security definer set search_path=''
as $$
  select case
    when p.role::text='admin' then 'admin'
    when p.role::text='promoteur' then 'promoteur'
    when p.role::text='caisse' then 'caisse'
    when p.fonction_interne='responsable' or p.role::text='pharmacie' then 'responsable'
    when p.role::text='client' then 'client'
    else coalesce(p.fonction_interne,p.role::text)
  end
  from public.profiles p
  where p.id=p_profile;
$$;

create or replace function private.naxa_promoteur_valide(p_promoteur uuid default auth.uid())
returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.profiles p
    where p.id=$1 and p.role::text='promoteur' and p.actif
  );
$$;

create or replace function public.naxa_can(p_action text,p_pharmacie uuid,p_target uuid default null)
returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1
    from public.profiles actor
    where actor.id=(select auth.uid()) and actor.actif
      and (
        actor.role::text='admin'
        or (
          actor.role::text='promoteur'
          and (
            p_action in ('ASSIGN_PRIVILEGE','REVOKE_PRIVILEGE')
            and exists(
              select 1 from public.promoteur_pharmacies pp
              where pp.promoteur_id=actor.id and pp.pharmacie_id=p_pharmacie and pp.actif
            )
            and (p_target is null or exists(
              select 1 from public.profiles t
              where t.id=p_target and t.actif and t.pharmacie_id=p_pharmacie
                and t.niveau_interne in (2,3)
            ))
          )
        )
        or (
          actor.niveau_interne=2 and
          public.naxa_business_function(actor.id)='responsable' and
          p_action in ('ASSIGN_PRIVILEGE','REVOKE_PRIVILEGE') and
          exists(
            select 1 from public.profiles t
            where t.id=p_target and t.actif and t.pharmacie_id=p_pharmacie
              and t.niveau_interne=3 and t.parent_profile_id=actor.id
          )
        )
      )
  );
$$;

create or replace function private.naxa_has_privilege(p_uid uuid,p_privilege text,p_pharmacie uuid,p_scope text)
returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1
    from public.naxa_profile_privileges pp
    join public.naxa_privileges p on p.code=pp.privilege_code
    join public.profiles u on u.id=pp.profile_id
    where pp.profile_id=p_uid and pp.privilege_code=p_privilege
      and pp.active and p.active and u.actif
      and pp.scope_type=p_scope
      and pp.pharmacie_id is not distinct from case when p_scope='RESEAU' then null else p_pharmacie end
      and (
        (p_scope='RESEAU' and u.role::text='promoteur' and exists(
          select 1 from public.promoteur_pharmacies x
          join public.pharmacies ph on ph.id=x.pharmacie_id
          where x.promoteur_id=p_uid and x.actif and ph.actif
        ))
        or
        (p_scope in ('PHARMACIE','POSTE_CAISSE') and u.pharmacie_id=p_pharmacie)
      )
      and private.naxa_promoteur_valide(case when u.role::text='promoteur' then u.id else null end)
  );
$$;

create or replace function public.naxa_has_privilege(p_privilege text,p_pharmacie uuid default null,p_scope text default 'PHARMACIE')
returns boolean
language sql stable security definer set search_path=''
as $$
  select private.naxa_has_privilege((select auth.uid()),$1,$2,$3);
$$;

create or replace function public.naxa_grant_privilege(p_target uuid,p_privilege text,p_pharmacie uuid,p_scope text default 'PHARMACIE')
returns uuid
language plpgsql security definer set search_path=''
as $$
begin
  return private.naxa_grant_privilege($1,$2,$3,$4);
end;
$$;

create or replace function public.naxa_revoke_privilege(p_target uuid,p_privilege text,p_pharmacie uuid,p_scope text default 'PHARMACIE')
returns void
language plpgsql security definer set search_path=''
as $$
begin
  perform private.naxa_revoke_privilege($1,$2,$3,$4);
end;
$$;

create or replace function public.naxa_provision_promoteur_pharmacie(p_promoteur uuid,p_pharmacie uuid)
returns void
language plpgsql security definer set search_path=''
as $$
begin
  raise exception 'LEGACY_PRIVILEGE_PROVISIONING_DISABLED';
end;
$$;

revoke all on function public.naxa_provision_promoteur_pharmacie(uuid,uuid) from public,anon,authenticated;
revoke all on function public.naxa_grant_privilege(uuid,text,uuid,text) from public,anon;
revoke all on function public.naxa_revoke_privilege(uuid,text,uuid,text) from public,anon;

commit;
