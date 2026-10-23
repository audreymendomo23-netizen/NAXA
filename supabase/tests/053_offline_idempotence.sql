-- NAXA ERP-012 — Tests structurels : idempotence et synchronisation offline
-- Exécution dans l'environnement Supabase de test.

do $$
begin
  if to_regclass('public.offline_operations') is null then
    raise exception 'offline_operations absent';
  end if;

  if to_regclass('public.stocks') is null then
    raise exception 'stocks absent';
  end if;

  if to_regprocedure('public.offline_stock_set_quantity(uuid,uuid,uuid,integer,timestamptz)') is null then
    raise exception 'offline_stock_set_quantity absent';
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.offline_operations'::regclass
       and contype = 'p'
  ) then
    raise exception 'operation_id doit être la clé primaire';
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname='public'
       and tablename='offline_operations'
       and policyname='offline_operations_select_own'
  ) then
    raise exception 'RLS lecture personnelle absente';
  end if;

  if exists (
    select 1 from pg_policies
     where schemaname='public'
       and tablename='offline_operations'
       and policyname in ('offline_operations_insert_scope','offline_operations_update_own')
  ) then
    raise exception 'Les écritures directes offline doivent rester désactivées';
  end if;

  if has_table_privilege('authenticated','public.offline_operations','INSERT') then
    raise exception 'INSERT direct offline interdit';
  end if;

  if has_function_privilege(
       'anon',
       'public.offline_stock_set_quantity(uuid,uuid,uuid,integer,timestamptz)',
       'EXECUTE'
     ) then
    raise exception 'anon ne doit pas exécuter la RPC offline';
  end if;

  if has_table_privilege('authenticated','public.offline_operations','UPDATE') then
    raise exception 'UPDATE direct offline interdit';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.offline_stock_set_quantity(uuid,uuid,uuid,integer,timestamptz)',
       'EXECUTE'
     ) then
    raise exception 'authenticated doit pouvoir exécuter la RPC offline';
  end if;
end $$;

select '053_offline_idempotence PASS' as resultat;
