-- NAXA — provenance des photos de référence des spécialités du référentiel.
-- Une image n'est publiable que si le chemin, la source, la licence et la date de validation existent.
begin;

alter table public.medicaments_referentiel_sources
  add column if not exists photo_path text,
  add column if not exists photo_source_url text,
  add column if not exists photo_licence text,
  add column if not exists photo_attribution text,
  add column if not exists photo_verifiee_le timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.medicaments_referentiel_sources'::regclass
      and conname = 'medicaments_reference_photo_provenance_complete'
  ) then
    alter table public.medicaments_referentiel_sources
      add constraint medicaments_reference_photo_provenance_complete
      check (
        photo_path is null
        or (
          photo_path !~ '(^/|\.\.|\\)'
          and photo_source_url like 'https://%'
          and length(trim(coalesce(photo_licence, ''))) >= 5
          and photo_verifiee_le is not null
        )
      );
  end if;
end
$$;

create index if not exists medicaments_reference_photo_ready_idx
  on public.medicaments_referentiel_sources (cis)
  where photo_path is not null and photo_source_url is not null
    and photo_licence is not null and photo_verifiee_le is not null;

comment on column public.medicaments_referentiel_sources.photo_path is
  'Chemin de la photo de référence dans le bucket medicaments, sans URL distante non vérifiée.';
comment on column public.medicaments_referentiel_sources.photo_source_url is
  'Page source de l’image originale sur Wikimedia Commons ou autre source autorisée.';
comment on column public.medicaments_referentiel_sources.photo_licence is
  'Licence autorisant la réutilisation commerciale de la photo.';
comment on column public.medicaments_referentiel_sources.photo_attribution is
  'Crédit à afficher selon la licence de la photo.';
comment on column public.medicaments_referentiel_sources.photo_verifiee_le is
  'Horodatage de vérification de la correspondance image/médicament et des droits.';

commit;
