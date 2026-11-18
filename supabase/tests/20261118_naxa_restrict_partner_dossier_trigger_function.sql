-- Security regression: trigger-only function must not be callable through PostgREST.
do $$
declare
  v_trigger_count integer;
begin
  if has_function_privilege('anon', 'public.naxa_sync_partner_subscription_dossier()', 'EXECUTE') then
    raise exception 'FAIL: anon can execute trigger-only function';
  end if;
  if has_function_privilege('authenticated', 'public.naxa_sync_partner_subscription_dossier()', 'EXECUTE') then
    raise exception 'FAIL: authenticated can execute trigger-only function';
  end if;

  select count(*) into v_trigger_count
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
  where not t.tgisinternal
    and t.tgrelid = 'public.admin_partner_dossiers'::regclass
    and p.oid = 'public.naxa_sync_partner_subscription_dossier()'::regprocedure;

  if v_trigger_count <> 1 then
    raise exception 'FAIL: expected trigger trg_partner_subscription_dossier_sync to remain installed, got %', v_trigger_count;
  end if;
end;
$$;
select 'PASS: trigger-only function ACL restricted; trigger remains installed' as result;
