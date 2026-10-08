-- NAXA 024 — périmètre canonique Promoteur → pharmacies
-- Additif non destructif. Le lien réseau Promoteur/pharmacie est la source de scope
-- pour Pilotage, validité, architecture et autorisations. Une pharmacie peut appartenir
-- à un seul Promoteur actif à la fois ; un Promoteur peut gérer plusieurs pharmacies.

create table if not exists public.promoteur_pharmacies (
  promoteur_id uuid not null references public.profiles(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (promoteur_id, pharmacie_id)
);

create index if not exists promoteur_pharmacies_promoteur_idx
  on public.promoteur_pharmacies(promoteur_id, actif);

create index if not exists promoteur_pharmacies_pharmacie_idx
  on public.promoteur_pharmacies(pharmacie_id, actif);

alter table public.promoteur_pharmacies enable row level security;

drop policy if exists promoteur_pharmacies_read_scope on public.promoteur_pharmacies;
create policy promoteur_pharmacies_read_scope
on public.promoteur_pharmacies
for select to authenticated
using (
  public.is_admin()
  or promoteur_id=(select auth.uid())
  or exists (
    select 1
    from public.profiles p
    where p.id=(select auth.uid())
      and p.pharmacie_id=promoteur_pharmacies.pharmacie_id
      and p.actif
      and p.niveau_interne in (2,3)
  )
);

revoke all on public.promoteur_pharmacies from anon, authenticated;
grant select on public.promoteur_pharmacies to authenticated;

-- Les écritures passent par les fonctions d'accréditation/administration :
-- aucun INSERT/UPDATE/DELETE direct depuis le client.
