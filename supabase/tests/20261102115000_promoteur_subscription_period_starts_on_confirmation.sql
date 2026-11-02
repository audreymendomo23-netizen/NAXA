-- NAXA — période d'abonnement après confirmation réelle du règlement.
-- Contrôle structurel non destructif ; ne déclenche aucune confirmation de paiement.
begin;

do $test$
declare
  v_definition text;
  v_lower text;
  v_security_definer boolean;
begin
  select pg_get_functiondef(p.oid), p.prosecdef
    into v_definition, v_security_definer
  from pg_proc p
  where p.oid = to_regprocedure('public.admin_confirmer_reglement_promoteur(uuid,uuid)');

  if v_definition is null or v_security_definer is distinct from true then
    raise exception 'La RPC de confirmation doit exister et rester SECURITY DEFINER';
  end if;
  v_lower := lower(v_definition);

  if position('v_debut := (now() at time zone ''africa/douala'')::date' in v_lower) = 0
     or position('greatest(' in v_lower) <> 0
     or position('a.echeance + 1' in v_lower) <> 0 then
    raise exception 'La période doit démarrer à la date réelle de confirmation, sans report à l''ancienne échéance';
  end if;

  if position('v_fin := (v_debut + interval ''1 month'' - interval ''1 day'')::date' in v_lower) = 0 then
    raise exception 'La période mensuelle doit conserver sa borne calendaire';
  end if;

  if position('for update' in v_lower) = 0
     or position('r.statut=''confirme''' in v_lower) = 0
     or position('r.statut<>''en_attente''' in v_lower) = 0
     or position('p_admin' in v_lower) = 0 then
    raise exception 'Verrouillage, idempotence, statut en attente ou vérification Admin absents';
  end if;

  if has_function_privilege('anon','public.admin_confirmer_reglement_promoteur(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.admin_confirmer_reglement_promoteur(uuid,uuid)','EXECUTE')
     or not has_function_privilege('service_role','public.admin_confirmer_reglement_promoteur(uuid,uuid)','EXECUTE') then
    raise exception 'Les ACL de confirmation doivent rester service_role uniquement';
  end if;
end
$test$;

rollback;
select 'promoter_payment_period_from_confirmation PASS (structurel)' as resultat;
