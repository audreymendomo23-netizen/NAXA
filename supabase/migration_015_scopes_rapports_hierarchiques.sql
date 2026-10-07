-- NAXA — Passe 4 / C2 : scopes hiérarchiques des rapports
-- Additif non destructif. Ne supprime ni ne réécrit les rapports historiques.
-- La sécurité effective des scopes sera branchée sur le moteur hiérarchique canonique lors de sa passe d'implémentation.

alter table public.rapports
  add column if not exists scope_type text,
  add column if not exists scope_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists scope_pharmacie_id uuid references public.pharmacies(id) on delete set null;

alter table public.rapports drop constraint if exists rapports_scope_type_check;
alter table public.rapports add constraint rapports_scope_type_check
  check (scope_type is null or scope_type in ('PHARMACIE','RESPONSABLE','PROMOTEUR','NAXA'));

create index if not exists rapports_scope_profile_idx on public.rapports(scope_profile_id);
create index if not exists rapports_scope_pharmacie_idx on public.rapports(scope_pharmacie_id);

comment on column public.rapports.scope_type is
  'Scope canonique du rapport : PHARMACIE, RESPONSABLE, PROMOTEUR ou NAXA. Les anciennes portee/pharmacie_id restent pour compatibilité historique.';
comment on column public.rapports.scope_profile_id is
  'Profil propriétaire/autorité du scope lorsque le rapport est rattaché à un utilisateur hiérarchique.';
comment on column public.rapports.scope_pharmacie_id is
  'Pharmacie couverte par le rapport lorsque le scope est pharmacie ou responsable. Ne représente pas à lui seul le périmètre complet d’un Promoteur.';

-- Compatibilité : les rapports historiques sont explicitement mappables sans modification de leur contenu.
update public.rapports
set scope_type = case
  when portee='pharmacie' then 'PHARMACIE'
  when portee='admin' then 'NAXA'
end,
scope_pharmacie_id = pharmacie_id
where scope_type is null;

