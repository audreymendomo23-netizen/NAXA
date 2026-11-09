-- Verify legacy public telemetry RPCs are not executable from client roles.
begin;

do $$
declare
  v_log_recherche regprocedure := 'public.log_recherche(text[])'::regprocedure;
  v_log_evenement regprocedure := 'public.log_evenement(text,uuid,uuid,text,integer,double precision,double precision)'::regprocedure;
begin
  if has_function_privilege('anon', v_log_recherche, 'EXECUTE')
     or has_function_privilege('authenticated', v_log_recherche, 'EXECUTE') then
    raise exception 'log_recherche remains executable by a client role';
  end if;
  if has_function_privilege('anon', v_log_evenement, 'EXECUTE')
     or has_function_privilege('authenticated', v_log_evenement, 'EXECUTE') then
    raise exception 'log_evenement remains executable by a client role';
  end if;
  if not has_function_privilege('service_role', v_log_recherche, 'EXECUTE')
     or not has_function_privilege('service_role', v_log_evenement, 'EXECUTE') then
    raise exception 'service_role lost required execution permission';
  end if;
end
$$;

rollback;
