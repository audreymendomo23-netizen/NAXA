-- NAXA 154 — tests de contrat pour la validation atomique.
-- Exécuter sur une base de test après migration_154; aucun dossier réel n'est modifié.
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
    and p.proname = 'admin_valider_dossier_pharmacie'
    and pg_get_function_identity_arguments(p.oid) = 'p_pharmacie uuid, p_autorisations_verifiees boolean';

  if v_definition is null then
    raise exception 'RPC admin_valider_dossier_pharmacie manquante';
  end if;
  if not v_security_definer then
    raise exception 'La RPC de validation doit être SECURITY DEFINER pour la transaction administrative';
  end if;
  if position('public.is_admin()' in v_definition) = 0
     or position('p_autorisations_verifiees' in v_definition) = 0
     or position('public.naxa_provision_promoteur_pharmacie' in v_definition) = 0
     or position('visible_recherche = true' in v_definition) = 0
     or position('public.naxa_provision_promoteur_pharmacie' in v_definition) > position('visible_recherche = true' in v_definition) then
    raise exception 'La RPC ne couvre pas tous les contrôles requis';
  end if;

  if has_function_privilege('anon', 'public.admin_valider_dossier_pharmacie(uuid, boolean)', 'EXECUTE') then
    raise exception 'Le rôle anon ne doit pas pouvoir exécuter la RPC';
  end if;
  if not has_function_privilege('authenticated', 'public.admin_valider_dossier_pharmacie(uuid, boolean)', 'EXECUTE') then
    raise exception 'Le rôle authenticated doit pouvoir appeler la RPC (avec contrôle interne admin)';
  end if;
end
$test$;

rollback;
