begin;
do $test$
begin
 if to_regprocedure('public.stock_emplacement_modifier(uuid,uuid,text)') is null then raise exception 'RPC emplacement stock absente'; end if;
 if to_regprocedure('public.stock_lot_emplacement_modifier(uuid,text)') is null then raise exception 'RPC emplacement lot absente'; end if;
 if has_function_privilege('anon','public.stock_emplacement_modifier(uuid,uuid,text)','EXECUTE') then raise exception 'RPC emplacement stock accessible à anon'; end if;
 if has_function_privilege('anon','public.stock_lot_emplacement_modifier(uuid,text)','EXECUTE') then raise exception 'RPC emplacement lot accessible à anon'; end if;
end;
$test$;
rollback;
