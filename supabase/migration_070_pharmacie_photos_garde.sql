-- NAXA — métadonnées photo et périodes de garde (additif, sans modifier les RPC de recherche)
-- À valider sur une base de test propre avant toute proposition d'intégration.
alter table public.pharmacies
  add column if not exists photo_path text,
  add column if not exists photo_source_url text,
  add column if not exists photo_licence text,
  add column if not exists photo_verifiee_le timestamptz,
  add column if not exists garde_debut timestamptz,
  add column if not exists garde_fin timestamptz,
  add column if not exists garde_source_url text,
  add column if not exists garde_verifiee_le timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.pharmacies'::regclass
      and conname = 'pharmacies_garde_periode_coherente'
  ) then
    alter table public.pharmacies
      add constraint pharmacies_garde_periode_coherente
      check (
        (garde_debut is null and garde_fin is null)
        or (garde_debut is not null and garde_fin is not null and garde_fin > garde_debut)
      );
  end if;
end
$$;

comment on column public.pharmacies.photo_path is
  'Chemin d''une copie locale NAXA dans public/pharmacies ; ne pas stocker ici un lien hotlink vers la source.';
comment on column public.pharmacies.photo_source_url is
  'URL de la source originale, conservée pour traçabilité et vérification des droits.';
comment on column public.pharmacies.photo_licence is
  'Licence, autorisation ou justification documentée de réutilisation de la photo.';
comment on column public.pharmacies.photo_verifiee_le is
  'Date de vérification de l''association photo/pharmacie et des droits de réutilisation.';
comment on column public.pharmacies.garde_debut is
  'Début de la période de garde confirmée, fuseau horaire Africa/Douala à appliquer à la saisie.';
comment on column public.pharmacies.garde_fin is
  'Fin exclusive de la période de garde confirmée.';
comment on column public.pharmacies.garde_source_url is
  'Source de la période de garde publiée.';
comment on column public.pharmacies.garde_verifiee_le is
  'Dernière vérification humaine de la période de garde.';
