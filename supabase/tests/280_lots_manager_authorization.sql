begin;
do $test$
declare
  v_helper text:=pg_get_functiondef('public.naxa_can_manage_lots(uuid)'::regprocedure);
  v_recall text:=pg_get_functiondef('public.lot_rappeler(uuid,text,text)'::regprocedure);
  v_lots_read text;
  v_lots_insert text;
  v_lots_update text;
  v_lots_delete text;
  v_recall_read text;
  v_treatment_read text;
begin
  if position($needle$v_function='caisse' then return false$needle$ in v_helper)=0
    or position('naxa_scope_allows' in v_helper)=0
    or position('naxa_has_active_professional_assignment' in v_helper)=0
    or position('MANAGE_LOTS' in v_helper)=0 then
    raise exception 'Le helper de gestion des lots ne couvre pas rôle, périmètre, affectation et privilège';
  end if;
  if position('naxa_can_manage_lots' in v_recall)=0 then
    raise exception 'La RPC de déclaration du rappel doit réutiliser le helper commun';
  end if;
  select qual into v_lots_read from pg_policies where schemaname='public' and tablename='stocks_lots' and policyname='stocks_lots_lecture';
  select with_check into v_lots_insert from pg_policies where schemaname='public' and tablename='stocks_lots' and policyname='stocks_lots_manage_insert';
  select coalesce(qual,'')||' '||coalesce(with_check,'') into v_lots_update from pg_policies where schemaname='public' and tablename='stocks_lots' and policyname='stocks_lots_manage_update';
  select qual into v_lots_delete from pg_policies where schemaname='public' and tablename='stocks_lots' and policyname='stocks_lots_manage_delete';
  select qual into v_recall_read from pg_policies where schemaname='public' and tablename='rappels_lots' and policyname='rappels_lots_read_scope';
  select qual into v_treatment_read from pg_policies where schemaname='public' and tablename='rappels_lots_traitements' and policyname='rappels_lots_traitements_read';
  if position('naxa_can_manage_lots' in coalesce(v_lots_read,''))=0
    or position('naxa_can_manage_lots' in coalesce(v_lots_insert,''))=0
    or position('naxa_can_manage_lots' in coalesce(v_lots_update,''))=0
    or position('naxa_can_manage_lots' in coalesce(v_lots_delete,''))=0
    or position('naxa_can_manage_lots' in coalesce(v_recall_read,''))=0
    or position('naxa_can_manage_lots' in coalesce(v_treatment_read,''))=0 then
    raise exception 'Les policies RLS ne réutilisent pas le helper canonique';
  end if;
  if has_function_privilege('anon','public.naxa_can_manage_lots(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.naxa_can_manage_lots(uuid)','EXECUTE') then
    raise exception 'Le helper des lots doit être réservé aux sessions authentifiées';
  end if;
end;
$test$;
rollback;
select '280_lots_manager_authorization PASS' as resultat;
