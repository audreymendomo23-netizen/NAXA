-- F07 / 281 — contract checks for offline POS sale replay.
begin;
do $test$
declare
  v_table oid;
  v_function oid;
  v_rls boolean;
  v_definition text;
  v_result jsonb;
begin
  v_table:=to_regclass('public.naxa_offline_sales');
  if v_table is null then raise exception 'F07_281_FAIL: idempotency table missing'; end if;
  select relrowsecurity into v_rls from pg_class where oid=v_table;
  if v_rls is distinct from true then raise exception 'F07_281_FAIL: RLS disabled'; end if;
  if has_table_privilege('anon',v_table,'SELECT')
     or has_table_privilege('authenticated',v_table,'SELECT') then
    raise exception 'F07_281_FAIL: client can read server-owned idempotency records';
  end if;
  if not has_table_privilege('service_role',v_table,'SELECT') then
    raise exception 'F07_281_FAIL: service role cannot access idempotency records';
  end if;

  v_function:=to_regprocedure('public.naxa_apply_offline_sale_v1(uuid,uuid,jsonb,bigint)');
  if v_function is null then raise exception 'F07_281_FAIL: replay RPC missing'; end if;
  if not (select prosecdef from pg_proc where oid=v_function) then
    raise exception 'F07_281_FAIL: replay RPC is not SECURITY DEFINER';
  end if;
  if has_function_privilege('anon',v_function,'EXECUTE')
     or has_function_privilege('authenticated',v_function,'EXECUTE')
     or not has_function_privilege('service_role',v_function,'EXECUTE') then
    raise exception 'F07_281_FAIL: RPC execute ACL mismatch';
  end if;

  select pg_get_functiondef(v_function) into v_definition;
  if position('public.vente_creer' in v_definition)=0
     or position('public.vente_ajouter_produit' in v_definition)=0
     or position('public.vente_encaisser_finaliser' in v_definition)=0 then
    raise exception 'F07_281_FAIL: replay does not reuse the canonical POS transaction';
  end if;
  if position('%price_changed%' in v_definition)=0
     or position('%total_changed%' in v_definition)=0 then
    raise exception 'F07_281_FAIL: cached price/total mismatch not classified as conflict';
  end if;

  v_result:=public.naxa_apply_offline_sale_v1(null,null,'{}'::jsonb,1);
  if v_result->>'status'<>'rejected' then
    raise exception 'F07_281_FAIL: invalid envelope was not rejected';
  end if;
  raise notice 'F07_281_PASS: RLS, ACL, idempotency contract, canonical POS reuse and invalid-envelope rejection';
end
$test$;
rollback;
