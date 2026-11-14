-- NAXA — les fonctions métier internes utilisent le résolveur privé de poste actif.
begin;
do $rewrite_internal_active_role_calls$
declare r record; v_definition text; v_count integer:=0;
begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prokind='f'
      and p.oid<>'public.naxa_active_role_pharmacy(uuid)'::regprocedure
      and lower(p.prosrc) like '%public.naxa_active_role_pharmacy(%'
  loop
    v_definition:=replace(pg_get_functiondef(r.oid),'public.naxa_active_role_pharmacy(','private.naxa_active_role_pharmacy(');
    execute v_definition; v_count:=v_count+1;
  end loop;
  raise notice 'Internal active-role references redirected: %',v_count;
end;
$rewrite_internal_active_role_calls$;
commit;
