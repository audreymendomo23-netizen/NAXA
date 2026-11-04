-- NAXA 269 — en cas d'égalité exacte de l'horodatage, le comptage en ligne serveur gagne.
begin;
do $tie_priority$
declare
  v_definition text;
  v_old text:='00000000-0000-0000-0000-000000000000';
  v_new text:='ffffffff-ffff-ffff-ffff-ffffffffffff';
begin
  select pg_get_functiondef(
    'public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)'::regprocedure
  ) into v_definition;

  if position(v_old in v_definition)=0 then
    raise exception 'Migration 269 refusée : départage UUID attendu introuvable dans la RPC LWW';
  end if;

  v_definition:=replace(v_definition,v_old,v_new);
  execute v_definition;
end;
$tie_priority$;
commit;
