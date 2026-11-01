-- Régression : le scope Comptable ne doit pas dépendre de naxa_can(..., NULL),
-- car ce dernier réserve cette forme aux privilèges de consultation VIEW_*.
do $test$
declare
  v_def text;
begin
  select pg_get_functiondef('public.compta_scope_autorise(uuid)'::regprocedure) into v_def;
  if position('naxa_business_function' in v_def)=0
     or position('naxa_scope_allows' in v_def)=0
     or position('naxa_has_privilege' in v_def)=0
     or position('MANAGE_ACCOUNTING' in v_def)=0 then
    raise exception 'FAIL: compta_scope_autorise ne vérifie pas fonction, scope et privilège';
  end if;
  if position('naxa_can(' in v_def)>0 then
    raise exception 'FAIL: compta_scope_autorise utilise encore naxa_can avec cible nulle';
  end if;
  if not has_function_privilege('authenticated','public.compta_scope_autorise(uuid)','EXECUTE')
     or has_function_privilege('anon','public.compta_scope_autorise(uuid)','EXECUTE') then
    raise exception 'FAIL: ACL de compta_scope_autorise incorrecte';
  end if;
end
$test$;
