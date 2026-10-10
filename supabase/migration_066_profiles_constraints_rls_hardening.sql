-- NAXA 066 — correction additive des contraintes historiques et fermeture RLS
-- Ne modifie aucune migration existante. Cible : rejeu d'intégration/test uniquement.

begin;

-- Les migrations historiques ont laissé coexister des CHECK incompatibles :
-- la version *_ck bloque les fonctions internes autres que Responsable et
-- limite le niveau hiérarchique à 0..4, en contradiction avec le catalogue canonique.
alter table public.profiles
  drop constraint if exists profiles_fonction_interne_ck;

alter table public.profiles
  drop constraint if exists profiles_niveau_hierarchique_ck;

-- Verrouille les abonnements historiques : les abonnements Promoteur canoniques
-- sont gérés par abonnements_promoteurs/conventions_promoteurs.
alter table public.abonnements enable row level security;
drop policy if exists abonnements_admin_only on public.abonnements;
create policy abonnements_admin_only
  on public.abonnements
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on public.abonnements from anon, authenticated;
grant select, insert, update on public.abonnements to authenticated;

-- La table décrit les niveaux d'architecture : lecture pour utilisateurs connectés,
-- changements réservés à l'administration NAXA.
alter table public.naxa_architecture_niveaux enable row level security;
drop policy if exists naxa_architecture_niveaux_read on public.naxa_architecture_niveaux;
drop policy if exists naxa_architecture_niveaux_admin_write on public.naxa_architecture_niveaux;

create policy naxa_architecture_niveaux_read
  on public.naxa_architecture_niveaux
  for select
  to authenticated
  using (true);

create policy naxa_architecture_niveaux_admin_write
  on public.naxa_architecture_niveaux
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on public.naxa_architecture_niveaux from anon, authenticated;
grant select, insert, update, delete on public.naxa_architecture_niveaux to authenticated;

commit;
