begin;
do $test$
declare
  v_policy record;
begin
  select cmd,roles,qual,with_check into v_policy
  from pg_policies
  where schemaname='public' and tablename='stocks' and policyname='stocks_import_update';
  if not found then raise exception 'Policy stocks_import_update absente'; end if;
  if v_policy.cmd<>'UPDATE' then raise exception 'La policy import doit couvrir UPDATE'; end if;
  if position('IMPORT_STOCK' in coalesce(v_policy.qual,''))=0
    or position('IMPORT_STOCK' in coalesce(v_policy.with_check,''))=0 then
    raise exception 'USING et WITH CHECK doivent exiger IMPORT_STOCK';
  end if;
  if position('naxa_has_privilege' in v_policy.qual)=0
    or position('naxa_has_privilege' in v_policy.with_check)=0 then
    raise exception 'La policy doit utiliser le moteur de privilèges canonique';
  end if;
end;
$test$;
rollback;
select '273_stock_import_update_privilege PASS' as resultat;
