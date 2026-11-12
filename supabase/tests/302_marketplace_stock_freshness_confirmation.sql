do $$
declare v_def text;
begin
  select pg_get_functiondef('private.marketplace_stock_last_quantity_update(uuid,uuid)'::regprocedure) into v_def;
  if position('greatest(' in v_def)=0 or position('s.updated_at' in v_def)=0
     or position('stock_manager_movement_journal' in v_def)=0 then
    raise exception 'FRESHNESS_MUST_USE_LATEST_OF_JOURNAL_AND_STOCK_ROW_UPDATE';
  end if;
end $$;

select 'MARKETPLACE_STOCK_VERIFICATION_TIMESTAMP PASS' as result;
