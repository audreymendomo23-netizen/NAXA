-- Expose uniquement les données d'assurance nécessaires à la recherche Marketplace.
-- Les références de convention, acteurs et données financières restent privées.

insert into public.assureurs (nom, code, actif, nom_normalise)
values
  ('CNPS', 'CNPS', true, private.assurance_normaliser_nom('CNPS')),
  ('Activa', 'ACTIVA', true, private.assurance_normaliser_nom('Activa')),
  ('Chanas Assurances', 'CHANAS', true, private.assurance_normaliser_nom('Chanas Assurances')),
  ('Allianz', 'ALLIANZ', true, private.assurance_normaliser_nom('Allianz')),
  ('SAAR Assurances', 'SAAR', true, private.assurance_normaliser_nom('SAAR Assurances'))
on conflict (nom_normalise) where actif = true and nom_normalise is not null
do nothing;

create or replace view public.marketplace_assureurs
with (security_barrier = true)
as
select a.id, a.nom, a.code
from public.assureurs a
where a.actif = true;

create or replace view public.marketplace_assurance_conventions
with (security_barrier = true)
as
select c.pharmacie_id, c.assureur_id, c.date_debut, c.date_fin
from public.assurance_conventions c
join public.pharmacies p on p.id = c.pharmacie_id
where c.statut = 'active'
  and c.date_debut <= current_date
  and (c.date_fin is null or c.date_fin >= current_date)
  and p.visible_recherche = true
  and p.est_demo = false
  and p.archivee_le is null;

grant select on public.marketplace_assureurs to anon, authenticated;
grant select on public.marketplace_assurance_conventions to anon, authenticated;

comment on view public.marketplace_assureurs is
  'Catalogue public des assureurs actifs, sans métadonnées internes.';
comment on view public.marketplace_assurance_conventions is
  'Conventions actives et valides des pharmacies publiées, données minimales pour la recherche Marketplace.';
