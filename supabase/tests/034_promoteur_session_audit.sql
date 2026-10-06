-- NAXA 034 — tests de structure des traces de sessions
-- Ce test ne crée aucune donnée persistante.

do $$
declare
  v_policy_count integer;
  v_trigger_count integer;
  v_secret_columns integer;
begin
  if to_regclass('public.naxa_session_audit') is null then
    raise exception 'ASSERT 1: table naxa_session_audit absente';
  end if;

  select count(*) into v_policy_count
  from pg_policies
  where schemaname='public'
    and tablename='naxa_session_audit'
    and policyname='naxa_session_audit_read_scope';

  if v_policy_count <> 1 then
    raise exception 'ASSERT 2: policy de lecture scope absente';
  end if;

  select count(*) into v_trigger_count
  from pg_trigger
  where tgrelid='auth.sessions'::regclass
    and tgname in ('trg_naxa_session_audit_insert','trg_naxa_session_audit_delete');

  if v_trigger_count <> 2 then
    raise exception 'ASSERT 3: triggers audit incomplets';
  end if;

  select count(*) into v_secret_columns
  from information_schema.columns
  where table_schema='public'
    and table_name='naxa_session_audit'
    and column_name in (
      'access_token','refresh_token','token','cookie',
      'access_token_hash','refresh_token_hash'
    );

  if v_secret_columns <> 0 then
    raise exception 'ASSERT 4: donnée secrète détectée';
  end if;

  if not exists (
    select 1
    from pg_proc
    where pronamespace='public'::regnamespace
      and proname='naxa_record_session_audit'
  ) then
    raise exception 'ASSERT 5: fonction de journalisation absente';
  end if;

  raise notice 'NAXA 034 — 5/5 assertions structurelles PASS';
end $$;
