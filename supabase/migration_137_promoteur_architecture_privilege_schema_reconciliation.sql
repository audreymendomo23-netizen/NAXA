-- NAXA 137 — réconciliation ciblée du schéma Promoteur/architecture.
-- Ne remplace pas les RPC de sécurité déjà durcies : le migration 020 historique
-- contient des définitions plus anciennes incompatibles avec les façades en Production.
begin;

alter table public.conventions_promoteurs
  add column if not exists architecture_code text;

create table if not exists public.naxa_architectures (
  code text primary key,
  libelle text not null,
  description text not null,
  max_responsables integer,
  max_caisses integer,
  custom_roles boolean not null default false,
  active boolean not null default true
);

insert into public.naxa_architectures(code,libelle,description,max_responsables,max_caisses,custom_roles)
values
 ('ORPHELIN','1 niveau / ORPHELIN','Promoteur avec une seule Caisse maximum',0,1,false),
 ('PARENTS_ENFANTS','2 niveaux / PARENTS → ENFANTS','Promoteur avec jusqu’à 5 Caisses, sans Responsable',0,5,false),
 ('PARENTS_AINES_CADETS','3 niveaux / PARENTS → AÎNÉS → CADETS','Promoteur, jusqu’à 5 Responsables et jusqu’à 5 Caisses',5,5,false),
 ('HYBRIDE','HYBRIDE / plusieurs niveaux','Rôles et utilisateurs composables dans les limites NAXA',null,null,true)
on conflict (code) do update set
 libelle=excluded.libelle,
 description=excluded.description,
 max_responsables=excluded.max_responsables,
 max_caisses=excluded.max_caisses,
 custom_roles=excluded.custom_roles,
 active=true;

alter table public.naxa_privileges add column if not exists famille text;
alter table public.naxa_privileges add column if not exists libelle text;
alter table public.naxa_privileges add column if not exists governance_only boolean;

update public.naxa_privileges
set famille=coalesce(famille,family,'RBAC'),
    libelle=coalesce(libelle,description,code),
    governance_only=coalesce(governance_only,governance,false),
    family=coalesce(family,famille,'RBAC'),
    description=coalesce(description,libelle,code);

alter table public.naxa_privileges alter column famille set not null;
alter table public.naxa_privileges alter column libelle set not null;
alter table public.naxa_privileges alter column governance_only set default false;
alter table public.naxa_privileges alter column governance_only set not null;

do $fk$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.conventions_promoteurs'::regclass
      and conname='conventions_promoteurs_architecture_code_fkey'
  ) then
    alter table public.conventions_promoteurs
      add constraint conventions_promoteurs_architecture_code_fkey
      foreign key (architecture_code) references public.naxa_architectures(code)
      on delete restrict not valid;
  end if;
end
$fk$;

alter table public.naxa_architectures enable row level security;
drop policy if exists naxa_architectures_read on public.naxa_architectures;
create policy naxa_architectures_read on public.naxa_architectures
  for select to authenticated using (active);
revoke all on public.naxa_architectures from anon,authenticated;
grant select on public.naxa_architectures to authenticated;

commit;
