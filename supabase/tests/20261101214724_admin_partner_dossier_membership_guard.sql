-- NAXA — contrat de cohérence des relations à la validation d'un dossier partenaire.
begin;

do $test$
declare
  v_definition text;
  v_config text[];
  v_security_definer boolean;
begin
  select pg_get_functiondef(p.oid), p.prosecdef, p.proconfig
    into v_definition, v_security_definer, v_config
  from pg_proc p
  where p.oid=to_regprocedure('public.admin_valider_dossier_partenaire(uuid)');

  if v_definition is null then
    raise exception 'RPC admin_valider_dossier_partenaire absente';
  end if;
  if v_security_definer is distinct from true
     or not coalesce(v_config @> array['search_path=""']::text[], false)
     or position('public.is_admin()' in v_definition)=0 then
    raise exception 'La RPC doit rester SECURITY DEFINER, search_path vide et réservée à Admin actif';
  end if;
  if position('public.partner_members' in v_definition)=0
     or position('v_member_role is distinct from ''owner''' in lower(v_definition))=0 then
    raise exception 'La validation doit exiger le rattachement owner du Promoteur au partenaire';
  end if;
  if position('public.partner_universes' in v_definition)=0
     or position('v_association_enabled is distinct from false' in lower(v_definition))=0
     or position('get diagnostics v_rows = row_count' in lower(v_definition))=0 then
    raise exception 'La validation doit exiger et activer exactement l’association existante';
  end if;
  if position('v_expected_partner_type' in lower(v_definition))=0
     or position('v_partner_type is distinct from v_expected_partner_type' in lower(v_definition))=0 then
    raise exception 'Le type du partenaire doit correspondre à l’univers du dossier';
  end if;
  if has_function_privilege('anon','public.admin_valider_dossier_partenaire(uuid)','EXECUTE') then
    raise exception 'anon ne doit pas pouvoir valider un dossier partenaire';
  end if;
  if not has_function_privilege('authenticated','public.admin_valider_dossier_partenaire(uuid)','EXECUTE') then
    raise exception 'authenticated doit pouvoir appeler la RPC sous son contrôle Admin interne';
  end if;
end
$test$;

rollback;
select 'admin_partner_dossier_relationship_guard PASS (structurel)' as resultat;
