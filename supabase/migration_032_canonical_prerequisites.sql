-- NAXA — Migration 032 : prérequis du moteur canonique
-- Cette migration rétablit les objets dont la migration 033 dépend.
begin;
create schema if not exists private;

create table if not exists public.naxa_privileges(
 code text primary key,domaine text not null,description text not null,
 niveau_min smallint not null,niveau_max smallint not null,
 delegable boolean not null default false,governance boolean not null default false,active boolean not null default true
);
create table if not exists public.naxa_role_privileges(
 role_key text not null,privilege_code text not null references public.naxa_privileges(code) on delete cascade,
 primary key(role_key,privilege_code)
);
create table if not exists public.naxa_architecture_privileges(
 architecture_code text not null,role_key text not null,
 privilege_code text not null references public.naxa_privileges(code) on delete cascade,
 active boolean not null default true,
 primary key(architecture_code,role_key,privilege_code)
);
create table if not exists public.profile_privileges(
 profile_id uuid not null references public.profiles(id) on delete cascade,
 privilege_code text not null references public.naxa_privileges(code) on delete cascade,
 pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
 granted_by uuid references public.profiles(id) on delete set null,
 granted_at timestamptz not null default now(),
 revoked_at timestamptz,
 primary key(profile_id,privilege_code,pharmacie_id)
);
create table if not exists public.promoteur_pharmacies(
 promoteur_id uuid not null references public.profiles(id) on delete cascade,
 pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
 actif boolean not null default true,
 created_at timestamptz not null default now(),
 primary key(promoteur_id,pharmacie_id)
);
create table if not exists public.pharmacie_architectures(
 pharmacie_id uuid primary key references public.pharmacies(id) on delete restrict,
 architecture_code text not null,
 assigned_by uuid references public.profiles(id) on delete set null,
 max_responsables integer,max_caisses integer,
 assigned_at timestamptz not null default now(),active boolean not null default true
);

insert into public.naxa_privileges(code,domaine,description,niveau_min,niveau_max,delegable,governance)
values
('VIEW_NETWORK_PILOTAGE','pilotage','Voir le pilotage réseau autorisé',1,1,true,false),
('VIEW_PERFORMANCE_PILOTAGE','pilotage','Voir les KPI de performance du périmètre autorisé',0,3,true,false),
('VIEW_NETWORK_REPORT','reports','Voir les rapports réseau',1,1,true,false),
('VIEW_NETWORK_HEALTH','security','Voir la santé du réseau',1,1,true,false),
('VIEW_CA_BY_PHARMACY','pilotage','Voir le CA par pharmacie',1,1,true,false),
('VIEW_COMPARISON','pilotage','Comparer les pharmacies autorisées',1,1,true,false),
('REACTIVATE_CAISSE','users','Réactiver une caisse',1,2,true,false),
('ASSIGN_PRIVILEGE','gouvernance','Attribuer un privilège délégable',1,3,false,true),
('REVOKE_PRIVILEGE','gouvernance','Révoquer un privilège',1,3,false,true)
on conflict(code) do nothing;

insert into public.naxa_role_privileges(role_key,privilege_code)
select r.role_key,p.code
from (values('promoteur'),('responsable'),('caisse')) r(role_key)
cross join (values('VIEW_NETWORK_PILOTAGE'),('VIEW_PERFORMANCE_PILOTAGE'),('VIEW_NETWORK_REPORT'),('VIEW_NETWORK_HEALTH'),('VIEW_CA_BY_PHARMACY'),('VIEW_COMPARISON'),('REACTIVATE_CAISSE')) p(code)
where not(p.code in('VIEW_NETWORK_PILOTAGE','VIEW_NETWORK_REPORT','VIEW_NETWORK_HEALTH','VIEW_CA_BY_PHARMACY','VIEW_COMPARISON') and r.role_key<>'promoteur')
on conflict do nothing;

insert into public.naxa_architecture_privileges(architecture_code,role_key,privilege_code)
select a.code,r.role_key,p.code
from (values('ORPHELIN'),('PARENTS_ENFANTS'),('PARENTS_AINES_CADETS'),('HYBRIDE')) a(code)
cross join (values('promoteur'),('responsable'),('caisse')) r(role_key)
cross join (values('VIEW_NETWORK_PILOTAGE'),('VIEW_PERFORMANCE_PILOTAGE'),('REACTIVATE_CAISSE')) p(code)
where not(p.code='VIEW_NETWORK_PILOTAGE' and r.role_key<>'promoteur')
on conflict do nothing;

create or replace function public.naxa_business_function(p_profile uuid)
returns text language sql stable security definer set search_path=''
as $$ select case when p.role::text='admin' then 'admin' when p.role::text='promoteur' then 'promoteur' when p.role::text='caisse' then 'caisse' when p.role::text='pharmacie' then 'responsable' when p.role::text='client' then 'client' else p.fonction_interne end from public.profiles p where p.id=p_profile $$;

create or replace function public.naxa_promoteur_valide(p_promoteur uuid default auth.uid())
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.profiles p where p.id=$1 and p.role::text='promoteur' and p.actif) $$;

commit;
