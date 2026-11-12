-- Contrat de sécurité des jetons Firebase Android.
do $test$
declare
  table_ok boolean;
  rls_ok boolean;
  policy_ok boolean;
  anon_denied boolean;
begin
  select exists(select 1 from information_schema.tables
    where table_schema='public' and table_name='naxa_fcm_tokens') into table_ok;
  if not table_ok then raise exception 'naxa_fcm_tokens table missing'; end if;

  select relrowsecurity into rls_ok from pg_class
    where oid='public.naxa_fcm_tokens'::regclass;
  if not rls_ok then raise exception 'FCM token RLS is disabled'; end if;

  select exists(select 1 from pg_policies
    where schemaname='public' and tablename='naxa_fcm_tokens'
      and policyname='Users manage own FCM tokens'
      and 'authenticated'=any(roles)
      and qual like '%auth.uid()%'
      and with_check like '%auth.uid()%') into policy_ok;
  if not policy_ok then raise exception 'FCM token owner policy missing'; end if;

  select not has_table_privilege('anon','public.naxa_fcm_tokens','SELECT')
    and not has_table_privilege('anon','public.naxa_fcm_tokens','INSERT')
    into anon_denied;
  if not anon_denied then raise exception 'Anonymous access to FCM tokens is allowed'; end if;
end
$test$;

select 'naxa_fcm_android_tokens_contract_pass' as test, true as passed;
