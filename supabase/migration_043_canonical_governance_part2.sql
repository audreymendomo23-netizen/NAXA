-- NAXA Part 2: canonical profiles and architectures
begin;
alter table public.profiles
 add column if not exists fonction_interne text,
 add column if not exists niveau_interne smallint,
 add column if not exists niveau_hierarchique smallint,
 add column if not exists architecture_code text,
 add column if not exists custom_role_code text;

update public.profiles set niveau_hierarchique=4
 where role='client' and niveau_hierarchique is null;

alter table public.profiles
 drop constraint if exists profiles_fonction_interne_check,
 drop constraint if exists profiles_niveau_interne_ck,
 drop constraint if exists profiles_niveau_hierarchique_ck,
 drop constraint if exists profiles_architecture_code_check,
 drop constraint if exists profiles_role_hierarchy_canonical_ck,
 drop constraint if exists profiles_parent_not_self_ck;

alter table public.profiles
 add constraint profiles_fonction_interne_check
   check (fonction_interne is null or fonction_interne in ('promoteur','responsable','caisse','manager_regional','chef_agence','custom')),
 add constraint profiles_niveau_interne_ck
   check (niveau_interne is null or niveau_interne between 1 and 4),
 add constraint profiles_niveau_hierarchique_ck
   check (niveau_hierarchique is null or niveau_hierarchique between 0 and 4),
 add constraint profiles_architecture_code_check
   check (architecture_code is null or architecture_code in ('ORPHELIN','PARENTS_ENFANTS','PARENTS_AINES_CADETS','HYBRIDE')),
 add constraint profiles_parent_not_self_ck
   check (parent_profile_id is null or parent_profile_id<>id),
 add constraint profiles_role_hierarchy_canonical_ck
   check (
     (role='client' and niveau_hierarchique=4 and pharmacie_id is null and fonction_interne is null and parent_profile_id is null and architecture_code is null and custom_role_code is null)
     or (role='admin' and niveau_hierarchique=0 and pharmacie_id is null and fonction_interne is null and parent_profile_id is null and architecture_code is null and custom_role_code is null)
     or (role='promoteur' and niveau_hierarchique=1 and pharmacie_id is not null and fonction_interne='promoteur' and parent_profile_id is null and architecture_code is not null)
     or (role='pharmacie' and niveau_hierarchique=2 and pharmacie_id is not null and fonction_interne='responsable' and parent_profile_id is not null and architecture_code is not null)
     or (role='caisse' and niveau_hierarchique=3 and pharmacie_id is not null and fonction_interne='caisse' and parent_profile_id is not null and architecture_code is not null)
   );

create table if not exists public.pharmacie_architectures (
 pharmacie_id uuid primary key references public.pharmacies(id) on delete restrict,
 architecture_code text not null,
 assigned_by uuid references public.profiles(id) on delete set null,
 max_responsables integer,
 max_caisses integer,
 assigned_at timestamptz not null default now(),
 active boolean not null default true,
 constraint pharmacie_architecture_code_check check (architecture_code in ('ORPHELIN','PARENTS_ENFANTS','PARENTS_AINES_CADETS','HYBRIDE'),
 constraint pharmacie_architectures_max_responsables_check check (max_responsables is null or max_responsables>=0),
 constraint pharmacie_architectures_max_caisses_check check (max_caisses is null or max_caisses>=0),
 constraint pharmacie_architecures_check check (
   (architecure_code='ORPHELIN' and max_responsables=0 and max_caisses=1)
   or (architecure_code='PARENTS_ENFANTS' and max_responsables=0 and max_caisses=5)
   or (architecture_code='PARENTS_AINES_CADETS' and max_responsables=5 and max_caisses=5)
   or architecture_code='HYBRIDE'
 )
);
alter table public.pharmacie_architectures enable row level security;
commit;
