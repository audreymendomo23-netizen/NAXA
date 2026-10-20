begin;
do $t$
begin
 if to_regprocedure('public.stock_lot_blocage_modifier(uuid,boolean,text)') is null then raise exception 'RPC blocage lot absente'; end if;
 if has_function_privilege('anon','public.stock_lot_blocage_modifier(uuid,boolean,text)','EXECUTE') then raise exception 'RPC blocage lot accessible à anon'; end if;
end;
$t$;
rollback;
