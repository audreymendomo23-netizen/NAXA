-- Contrôle structurel de la RPC additive raccordée aux colonnes de migration 070.
begin;

do $test$
declare
  v_def text;
begin
  if to_regprocedure('public.set_garde_periode(timestamp with time zone,timestamp with time zone,text)') is null then
    raise exception 'RPC set_garde_periode absente';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='pharmacies' and column_name='garde_debut'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='pharmacies' and column_name='garde_fin'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='pharmacies' and column_name='garde_source_url'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='pharmacies' and column_name='garde_verifiee_le'
  ) then
    raise exception 'Colonnes de garde de migration 070 manquantes';
  end if;

  select pg_get_functiondef('public.set_garde_periode(timestamptz,timestamptz,text)'::regprocedure)
    into v_def;
  if position('MANAGE_GUARD_STATUS' in v_def)=0 or position('authorize' in v_def)=0 then
    raise exception 'La RPC ne vérifie pas le privilège canonique de gestion de garde';
  end if;
  if position('garde_source_url' in v_def)=0 or position('garde_verifiee_le' in v_def)=0 then
    raise exception 'La RPC ne persiste pas la source et la vérification';
  end if;
  if has_function_privilege('anon','public.set_garde_periode(timestamptz,timestamptz,text)','EXECUTE')
     or exists (
       select 1
       from pg_proc p,
            lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
       where p.oid='public.set_garde_periode(timestamptz,timestamptz,text)'::regprocedure
         and acl.grantee=0
         and acl.privilege_type='EXECUTE'
     ) then
    raise exception 'RPC accessible à anon ou public';
  end if;
end;
$test$;

select true as naxa_071b_garde_period_rpc_pass;
rollback;
