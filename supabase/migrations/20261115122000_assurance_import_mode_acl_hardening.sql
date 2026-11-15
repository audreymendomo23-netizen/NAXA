-- L'API publique doit imposer un mode complet/delta explicite via la façade.
create or replace function public.assurance_import_simuler_mode(
  p_pharmacie uuid,
  p_assureur uuid,
  p_reference_source text,
  p_nom_fichier text,
  p_sha256 text,
  p_lignes jsonb,
  p_mode_import text default 'delta'
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_result jsonb;
  v_import uuid;
begin
  if p_mode_import is null or p_mode_import not in ('complet','delta') then
    raise exception 'Mode import invalide : utilisez complet ou delta';
  end if;
  v_result:=public.assurance_import_simuler(
    p_pharmacie,p_assureur,p_reference_source,p_nom_fichier,p_sha256,p_lignes
  );
  v_import:=(v_result->>'import_id')::uuid;
  update public.assurance_imports set mode_import=p_mode_import where id=v_import;
  return v_result||jsonb_build_object('mode_import',p_mode_import);
end;
$function$;

revoke all on function public.assurance_import_simuler(uuid,uuid,text,text,text,jsonb)
  from public,anon,authenticated;
revoke all on function public.assurance_import_simuler_mode(uuid,uuid,text,text,text,jsonb,text)
  from public,anon;
grant execute on function public.assurance_import_simuler_mode(uuid,uuid,text,text,text,jsonb,text)
  to authenticated;
