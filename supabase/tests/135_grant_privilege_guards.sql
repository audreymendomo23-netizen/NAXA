-- NAXA 135 — régression des gardes d’attribution des privilèges.
-- Contrôle la fonction privée installée sans modifier les données métier.
do $test$
declare
  v_definition text;
  v_signature regprocedure := 'private.naxa_grant_privilege(uuid,text,uuid,text)'::regprocedure;
begin
  v_definition := lower(pg_get_functiondef(v_signature));

  if position('p_scope is null' in v_definition)=0
     or position('p_scope not in' in v_definition)=0 then
    raise exception '135.1 : un scope NULL ou inconnu doit être refusé explicitement';
  end if;
  if position('p_target is null' in v_definition)=0
     or position('p_pharmacie is null' in v_definition)=0
     or position('btrim(p_privilege)' in v_definition)=0 then
    raise exception '135.2 : les paramètres obligatoires doivent être validés';
  end if;
  if position('n.governance = false' in v_definition)=0
     or position('n.governance_only is not true' in v_definition)=0
     or position('n.delegable = true' in v_definition)=0
     or position('n.active = true' in v_definition)=0 then
    raise exception '135.3 : seuls les privilèges actifs, délégables et non-gouvernance sont attribuables';
  end if;
  if position('public.naxa_can(' in v_definition)=0
     or position('public.naxa_promoteur_valide' in v_definition)=0
     or position('where id=uid and actif=true' in v_definition)=0 then
    raise exception '135.4 : l’acteur doit être actif, le Promoteur valide et l’autorisation hiérarchique contrôlée';
  end if;
  if has_function_privilege('anon',v_signature,'EXECUTE')
     or has_function_privilege('authenticated',v_signature,'EXECUTE') then
    raise exception '135.5 : la fonction privée ne doit pas être directement exécutable par les rôles API';
  end if;
end
$test$;

select 'Vérification 135 — gardes d’attribution : PASS' as resultat;
