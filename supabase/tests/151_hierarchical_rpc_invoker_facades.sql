-- NAXA 151 — les RPC hiérarchiques exposées sont des façades invoker.
do $test$
declare
  v_public regprocedure;
  v_private regprocedure;
begin
  foreach v_public in array array[
    'public.naxa_provision_caisse(uuid,uuid)'::regprocedure,
    'public.naxa_set_caisse_status(uuid,boolean)'::regprocedure,
    'public.accrediter_profile(uuid,uuid,smallint,uuid)'::regprocedure,
    'public.accrediter_responsable(uuid,uuid)'::regprocedure
  ] loop
    if (select prosecdef from pg_proc where oid=v_public) then
      raise exception '151.1 : façade % ne doit pas être SECURITY DEFINER',v_public;
    end if;
    if not has_function_privilege('authenticated',v_public,'EXECUTE')
       or has_function_privilege('anon',v_public,'EXECUTE') then
      raise exception '151.2 : ACL incorrecte pour %',v_public;
    end if;
  end loop;
  foreach v_private in array array[
    'private.naxa_provision_caisse(uuid,uuid)'::regprocedure,
    'private.naxa_set_caisse_status(uuid,boolean)'::regprocedure,
    'private.accrediter_profile(uuid,uuid,smallint,uuid)'::regprocedure
  ] loop
    if not (select prosecdef from pg_proc where oid=v_private) then
      raise exception '151.3 : implémentation % doit être SECURITY DEFINER',v_private;
    end if;
  end loop;
end
$test$;
select 'Vérification 151 — façades RPC hiérarchiques : PASS' as resultat;
