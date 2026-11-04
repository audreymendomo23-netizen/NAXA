begin;
do $test$
begin
  if to_regclass('public.stock_manager_movement_journal') is null then
    raise exception 'Journal stock absent';
  end if;
  if not exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='stock_manager_movement_journal' and column_name='occurred_at') then
    raise exception 'Horodatage métier du journal absent';
  end if;
  if not exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='stock_manager_movement_journal' and column_name='event_source') then
    raise exception 'Provenance des événements du journal absente';
  end if;
  if not exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='offline_operations' and column_name='device_sequence') then
    raise exception 'Séquence appareil absente';
  end if;
  if not exists(select 1 from information_schema.columns
    where table_schema='public' and table_name='offline_operations' and column_name='modified_at') then
    raise exception 'Horodatage de modification offline absent';
  end if;
  if to_regclass('private.naxa_offline_lww_config') is null then
    raise exception 'Date d’activation LWW absente';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='offline_operations_device_sequence_uidx') then
    raise exception 'Unicité appareil/séquence absente';
  end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.stocks'::regclass and tgname='trg_journal_stock_manager_stocks') then
    raise exception 'Journal stock agrégé non branché';
  end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.stocks_lots'::regclass and tgname='trg_journal_stock_manager_lots') then
    raise exception 'Journal des lots non branché';
  end if;
  if has_function_privilege('anon','public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)','EXECUTE')
     or has_function_privilege('authenticated','public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)','EXECUTE')
     or not has_function_privilege('service_role','public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)','EXECUTE') then
    raise exception 'ACL RPC de synchronisation incorrectes';
  end if;
  if has_function_privilege('anon','public.offline_stock_set_quantity(uuid,uuid,uuid,integer,timestamptz)','EXECUTE')
     or not has_function_privilege('authenticated','public.offline_stock_set_quantity(uuid,uuid,uuid,integer,timestamptz)','EXECUTE') then
    raise exception 'ACL RPC de comptage en ligne incorrectes';
  end if;
  if has_table_privilege('authenticated','public.stock_manager_movement_journal','INSERT')
     or has_table_privilege('authenticated','public.stock_manager_movement_journal','UPDATE')
     or has_table_privilege('authenticated','public.stock_manager_movement_journal','DELETE') then
    raise exception 'Écriture directe interdite dans le journal append-only';
  end if;
  if not (select relrowsecurity from pg_class where oid='private.naxa_offline_lww_config'::regclass) then
    raise exception 'RLS de configuration LWW non activée';
  end if;
  if position('device_sequence_not_monotonic' in pg_get_functiondef('public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)'::regprocedure))=0 then
    raise exception 'Garde de séquence monotone absente de la RPC';
  end if;
  if position('superseded_by_newer_write' in pg_get_functiondef('public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint)'::regprocedure))=0 then
    raise exception 'Arbitrage LWW absent de la RPC';
  end if;
  if position('event_source' in pg_get_functiondef('private.journaliser_mouvement_stock_gestionnaire()'::regprocedure))=0 then
    raise exception 'Provenance du journal absente du trigger';
  end if;
end;
$test$;
rollback;
