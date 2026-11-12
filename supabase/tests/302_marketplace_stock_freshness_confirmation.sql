do $verify$
declare v_def text;
begin
  select pg_get_functiondef('private.marketplace_stock_last_quantity_update(uuid,uuid)'::regprocedure) into v_def;
  if position('case' in lower(v_def))=0
     or position('exists' in lower(v_def))=0
     or position('s.updated_at' in v_def)=0
     or position('stock_manager_movement_journal' in v_def)=0
     or position('event_type' in v_def)=0 then
    raise exception 'FRESHNESS_MUST_USE_JOURNAL_WHEN_PRESENT_AND_LEGACY_FALLBACK_ONLY_WITHOUT_JOURNAL';
  end if;
end
$verify$;

select 'MARKETPLACE_STOCK_VERIFICATION_TIMESTAMP PASS' as result;
