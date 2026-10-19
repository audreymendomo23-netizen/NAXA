-- NAXA 155 — contrat structurel de l'action Promoteur sur une pharmacie du réseau.
begin;

do $test$
declare
  v_definition text;
  v_security_definer boolean;
begin
  select pg_get_functiondef(p.oid), p.prosecdef
    into v_definition, v_security_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'set_garde_for_pharmacy'
    and pg_get_function_identity_arguments(p.oid) = 'p_pharmacie uuid, p_garde boolean';

  if v_definition is null then raise exception 'RPC set_garde_for_pharmacy absente'; end if;
  if not v_security_definer then raise exception 'RPC de garde doit être SECURITY DEFINER'; end if;
  if position('auth.uid()' in v_definition) = 0
     or position('role::text = ''promoteur''' in v_definition) = 0
     or position('public.naxa_has_privilege' in v_definition) = 0
     or position('actif = true' in v_definition) = 0
     or position('visible_recherche = true' in v_definition) = 0 then
    raise exception 'Contrôles de scope, rôle ou publication absents';
  end if;
  if has_function_privilege('anon', 'public.set_garde_for_pharmacy(uuid, boolean)', 'EXECUTE') then
    raise exception 'anon ne doit pas pouvoir changer la garde';
  end if;
  if not has_function_privilege('authenticated', 'public.set_garde_for_pharmacy(uuid, boolean)', 'EXECUTE') then
    raise exception 'authenticated doit pouvoir appeler la RPC protégée';
  end if;
end
$test$;

rollback;
