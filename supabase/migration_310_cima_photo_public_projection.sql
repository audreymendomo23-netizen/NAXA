-- NAXA 310 — projection publique minimale des photos CIMA pré-calculées.
-- La table de travail CIMA reste dans le schéma privé. Seules les photos dont
-- la correspondance BDPM/CIMA est forte, la dose concorde et la date média
-- officielle est présente sont exposées aux parcours publics du catalogue.

begin;

do $$
begin
  if to_regclass('private.medicamentos_cima_bdpm_jobs') is null then
    raise exception 'La table privée private.medicamentos_cima_bdpm_jobs doit exister avant la projection photo CIMA.';
  end if;
end
$$;

create or replace view public.medicaments_cima_photos_public
with (security_barrier = true) as
select
  j.cis,
  j.nom as nom_reference,
  j.nregistro,
  j.nom_cima,
  j.forme_cima,
  j.dosage_cima,
  j.substance_cima,
  j.score,
  boite.image_url as image_boite_url,
  boite.updated_at as photo_boite_updated_at,
  forme.image_url as image_forme_url,
  forme.updated_at as photo_forme_updated_at,
  nullif(trim(j.donnees_cima ->> 'labtitular'), '') as titulaire_cima
from private.medicamentos_cima_bdpm_jobs j
left join lateral (
  select validated.image_url, validated.updated_at
  from (
    select
      f.value ->> 'url' as image_url,
      case
        when f.value ->> 'fecha' ~ '^[0-9]{13}$'
          then (to_timestamp((f.value ->> 'fecha')::double precision / 1000.0) at time zone 'Europe/Madrid')::date
        when f.value ->> 'fecha' ~ '^[0-9]{10}$'
          then (to_timestamp((f.value ->> 'fecha')::double precision) at time zone 'Europe/Madrid')::date
        when f.value ->> 'fecha' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          then substring(f.value ->> 'fecha' from 1 for 10)::date
        else null
      end as updated_at
    from jsonb_array_elements(
      case
        when jsonb_typeof(j.donnees_cima -> 'fotos') = 'array'
          then j.donnees_cima -> 'fotos'
        else '[]'::jsonb
      end
    ) as f(value)
    where f.value ->> 'tipo' = 'materialas'
      and f.value ->> 'url' = j.image_boite_url
      and (f.value ->> 'url') ~ '^https://cima[.]aemps[.]es/cima/fotos/(thumbnails|full)/materialas/[0-9]+/[0-9]+_materialas[.]jpg$'
      and strpos(f.value ->> 'url', '/materialas/' || j.nregistro || '/') > 0
      and nullif(f.value ->> 'fecha', '') is not null
      and coalesce(f.value ->> 'licence', f.value ->> 'license', f.value ->> 'licencia', '') !~* '(^|[^A-Z])(NC|ND)([^A-Z]|$)|non[ -]?commercial|no[ -]?derivatives|derechos reservados'
      and (
        nullif(trim(coalesce(f.value ->> 'licence', f.value ->> 'license', f.value ->> 'licencia', '')), '') is null
        or coalesce(f.value ->> 'licence', f.value ->> 'license', f.value ->> 'licencia', '') ~* '^(CC0|Public Domain)( |$)'
        or (
          coalesce(f.value ->> 'licence', f.value ->> 'license', f.value ->> 'licencia', '') ~* '^CC BY(-SA)?( |$)'
          and nullif(trim(coalesce(f.value ->> 'licenceUrl', f.value ->> 'licenseUrl', f.value ->> 'licenciaUrl', '')), '') is not null
          and nullif(trim(coalesce(f.value ->> 'attribution', f.value ->> 'auteur', f.value ->> 'author', j.donnees_cima ->> 'labtitular', '')), '') is not null
        )
      )
  ) validated
  where validated.updated_at is not null
  limit 1
) boite on true
left join lateral (
  select validated.image_url, validated.updated_at
  from (
    select
      f.value ->> 'url' as image_url,
      case
        when f.value ->> 'fecha' ~ '^[0-9]{13}$'
          then (to_timestamp((f.value ->> 'fecha')::double precision / 1000.0) at time zone 'Europe/Madrid')::date
        when f.value ->> 'fecha' ~ '^[0-9]{10}$'
          then (to_timestamp((f.value ->> 'fecha')::double precision) at time zone 'Europe/Madrid')::date
        when f.value ->> 'fecha' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
          then substring(f.value ->> 'fecha' from 1 for 10)::date
        else null
      end as updated_at
    from jsonb_array_elements(
      case
        when jsonb_typeof(j.donnees_cima -> 'fotos') = 'array'
          then j.donnees_cima -> 'fotos'
        else '[]'::jsonb
      end
    ) as f(value)
    where f.value ->> 'tipo' = 'formafarmac'
      and f.value ->> 'url' = j.image_forme_url
      and (f.value ->> 'url') ~ '^https://cima[.]aemps[.]es/cima/fotos/(thumbnails|full)/formafarmac/[0-9]+/[0-9]+_formafarmac[.]jpg$'
      and strpos(f.value ->> 'url', '/formafarmac/' || j.nregistro || '/') > 0
      and nullif(f.value ->> 'fecha', '') is not null
      and coalesce(f.value ->> 'licence', f.value ->> 'license', f.value ->> 'licencia', '') !~* '(^|[^A-Z])(NC|ND)([^A-Z]|$)|non[ -]?commercial|no[ -]?derivatives|derechos reservados'
      and (
        nullif(trim(coalesce(f.value ->> 'licence', f.value ->> 'license', f.value ->> 'licencia', '')), '') is null
        or coalesce(f.value ->> 'licence', f.value ->> 'license', f.value ->> 'licencia', '') ~* '^(CC0|Public Domain)( |$)'
        or (
          coalesce(f.value ->> 'licence', f.value ->> 'license', f.value ->> 'licencia', '') ~* '^CC BY(-SA)?( |$)'
          and nullif(trim(coalesce(f.value ->> 'licenceUrl', f.value ->> 'licenseUrl', f.value ->> 'licenciaUrl', '')), '') is not null
          and nullif(trim(coalesce(f.value ->> 'attribution', f.value ->> 'auteur', f.value ->> 'author', j.donnees_cima ->> 'labtitular', '')), '') is not null
        )
      )
  ) validated
  where validated.updated_at is not null
  limit 1
) forme on true
where j.statut = 'correspondance_forte'
  and j.dose_concordante is true
  and j.score is not null
  and j.score >= 0.78
  and nullif(trim(j.nregistro), '') is not null
  and nullif(trim(j.nom_cima), '') is not null
  and nullif(trim(j.substance_cima), '') is not null
  and (
    (
      extensions.unaccent(lower(coalesce(j.forme, ''))) ~ '(comprime|tablet)'
      and extensions.unaccent(lower(coalesce(j.forme_cima, ''))) ~ '(comprimid|tablet)'
    )
    or (
      extensions.unaccent(lower(coalesce(j.forme, ''))) ~ '(gelule|capsule)'
      and extensions.unaccent(lower(coalesce(j.forme_cima, ''))) ~ '(capsul|gelul)'
    )
    or (
      extensions.unaccent(lower(coalesce(j.forme, ''))) ~ '(perfusion)'
      and extensions.unaccent(lower(coalesce(j.forme_cima, ''))) ~ '(perfusion)'
    )
    or (
      extensions.unaccent(lower(coalesce(j.forme, ''))) ~ '(injectable|injection)'
      and extensions.unaccent(lower(coalesce(j.forme_cima, ''))) ~ '(inyect|inject)'
    )
    or (
      extensions.unaccent(lower(coalesce(j.forme, ''))) ~ '(solution buvable|solution orale)'
      and extensions.unaccent(lower(coalesce(j.forme_cima, ''))) ~ '(solucion oral)'
    )
    or (
      extensions.unaccent(lower(coalesce(j.forme, ''))) ~ '(suspension buvable)'
      and extensions.unaccent(lower(coalesce(j.forme_cima, ''))) ~ '(suspension oral)'
    )
    or (
      extensions.unaccent(lower(coalesce(j.forme, ''))) ~ '(sirop)'
      and extensions.unaccent(lower(coalesce(j.forme_cima, ''))) ~ '(jarabe)'
    )
    or (
      extensions.unaccent(lower(coalesce(j.forme, ''))) ~ '(creme)'
      and extensions.unaccent(lower(coalesce(j.forme_cima, ''))) ~ '(crema)'
    )
    or (
      extensions.unaccent(lower(coalesce(j.forme, ''))) ~ '(pommade)'
      and extensions.unaccent(lower(coalesce(j.forme_cima, ''))) ~ '(pomada)'
    )
    or (
      extensions.unaccent(lower(coalesce(j.forme, ''))) ~ '(collyre|gouttes ophtalmiques)'
      and extensions.unaccent(lower(coalesce(j.forme_cima, ''))) ~ '(colirio|gotas oftalmicas)'
    )
    or (
      extensions.unaccent(lower(coalesce(j.forme, ''))) ~ '(poudre)'
      and extensions.unaccent(lower(coalesce(j.forme_cima, ''))) ~ '(polvo)'
    )
    or (
      extensions.unaccent(lower(coalesce(j.forme, ''))) ~ '(spray|pulverisation|aerosol)'
      and extensions.unaccent(lower(coalesce(j.forme_cima, ''))) ~ '(spray|pulverizacion|aerosol)'
    )
  )
  and (
    boite.image_url is not null
    or forme.image_url is not null
  );

comment on view public.medicaments_cima_photos_public is
  'Projection catalogue en lecture seule : correspondance BDPM/CIMA forte, dose concordante, hôte et chemin photo AEMPS vérifiés, URL liée à fotos[].fecha. Ne publie aucune donnée JSON CIMA brute ni donnée de traitement. Les visuels restent indicatifs pour le marché camerounais.';

revoke all on public.medicaments_cima_photos_public from public;
grant select on public.medicaments_cima_photos_public to anon, authenticated, service_role;

commit;
