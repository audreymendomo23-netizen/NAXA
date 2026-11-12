-- Corrige le compteur de localités pour refléter les identifiants réellement présents, sans compter plusieurs fois les lots rejoués.
begin;
create or replace function public.naxa_sync_localites_forest_atlas_page(
  p_offset integer default 0,
  p_limit integer default 500
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_response record;
  v_payload jsonb;
  v_feature jsonb;
  v_props jsonb;
  v_geometry jsonb;
  v_coords jsonb;
  v_objectid text;
  v_nom text;
  v_type text;
  v_population bigint;
  v_lat double precision;
  v_lng double precision;
  v_imported integer := 0;
  v_skipped integer := 0;
  v_fetched integer := 0;
  v_url text;
  v_error text;
begin
  if p_offset is null or p_offset < 0 or p_offset > 1000000
     or p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception 'offset ou limite de synchronisation invalide';
  end if;

  v_url :=
    'https://gis.forest-atlas.org/server/rest/services/cmr/open_data_fr/MapServer/146/query'
    || '?where=1%3D1'
    || '&outFields=objectid%2Cnom_lieu%2Cdesc_type%2Cpopulation'
    || '&returnGeometry=true&outSR=4326'
    || '&orderByFields=objectid'
    || '&resultOffset=' || p_offset::text
    || '&resultRecordCount=' || p_limit::text
    || '&f=geojson';

  select * into v_response from extensions.http_get(v_url);
  if v_response.status < 200 or v_response.status >= 300 then
    raise exception 'Source Forest Atlas indisponible (HTTP %)',v_response.status;
  end if;
  v_payload := v_response.content::jsonb;
  if jsonb_typeof(v_payload->'features') <> 'array' then
    raise exception 'Réponse Forest Atlas invalide : tableau de lieux absent';
  end if;

  for v_feature in select value from jsonb_array_elements(v_payload->'features')
  loop
    v_fetched := v_fetched + 1;
    v_props := coalesce(v_feature->'properties','{}'::jsonb);
    v_geometry := coalesce(v_feature->'geometry','{}'::jsonb);
    v_coords := v_geometry->'coordinates';
    v_objectid := coalesce(v_props->>'objectid',v_props->>'OBJECTID',v_feature->>'id');
    v_nom := nullif(trim(coalesce(v_props->>'nom_lieu','')),'');
    v_type := nullif(trim(coalesce(v_props->>'desc_type','')),'');
    v_lng := nullif(v_coords->>0,'')::double precision;
    v_lat := nullif(v_coords->>1,'')::double precision;
    v_population := nullif(v_props->>'population','')::bigint;

    if v_objectid is null or v_nom is null or v_type is null
       or v_geometry->>'type' <> 'Point'
       or v_lat is null or v_lng is null
       or v_lat < 1.5 or v_lat > 13.2 or v_lng < 8.2 or v_lng > 16.5 then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.localites_cameroun(
      source_code,source_id,nom,nom_normalise,type_localite,latitude,longitude,
      population,source_url,source_licence,precision_source,qualite,source_properties,
      last_seen_at,updated_at
    ) values (
      'forest_atlas_inc',v_objectid,v_nom,
      lower(extensions.unaccent(trim(v_nom))),v_type,v_lat,v_lng,
      v_population,
      'https://gis.forest-atlas.org/server/rest/services/cmr/open_data_fr/MapServer/146',
      'CC-BY-4.0',
      'MINFOF/WRI/INC; cartes topographiques 1:200 000; coordonnées approximatives; couche source non exhaustive.',
      'approximate',
      v_props,
      now(),now()
    )
    on conflict(source_code,source_id) do update set
      nom=excluded.nom,
      nom_normalise=excluded.nom_normalise,
      type_localite=excluded.type_localite,
      latitude=excluded.latitude,
      longitude=excluded.longitude,
      population=excluded.population,
      source_properties=excluded.source_properties,
      last_seen_at=now(),
      updated_at=now();
    v_imported := v_imported + 1;
  end loop;

  update public.localites_cameroun_sync
  set dernier_offset=p_offset+v_fetched,
      total_importe=(select count(*) from public.localites_cameroun where source_code='forest_atlas_inc'),
      total_ignore=total_ignore+v_skipped,
      derniere_synchronisation=now(),
      statut=case when v_fetched < p_limit then 'terminee' else 'en_cours' end,
      derniere_erreur=null,
      updated_at=now()
  where source_code='forest_atlas_inc';

  return jsonb_build_object(
    'source','forest_atlas_inc',
    'offset',p_offset,
    'limite',p_limit,
    'lignes_lues',v_fetched,
    'localites_importees',v_imported,
    'lignes_ignorees',v_skipped,
    'next_offset',p_offset+v_fetched,
    'terminee',v_fetched < p_limit,
    'attribution','MINFOF/WRI/INC — CC BY 4.0',
    'precision','Source approximative et non exhaustive; contrôle terrain non effectué.'
  );
exception when others then
  v_error := left(sqlerrm,1000);
  update public.localites_cameroun_sync
  set statut='erreur',derniere_erreur=v_error,updated_at=now()
  where source_code='forest_atlas_inc';
  raise;
end;
$function$;
revoke all on function public.naxa_sync_localites_forest_atlas_page(integer,integer) from public,anon,authenticated;
grant execute on function public.naxa_sync_localites_forest_atlas_page(integer,integer) to service_role;
update public.localites_cameroun_sync set total_importe=(select count(*) from public.localites_cameroun where source_code='forest_atlas_inc'), updated_at=now() where source_code='forest_atlas_inc';
commit;
