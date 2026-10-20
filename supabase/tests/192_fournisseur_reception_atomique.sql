begin;
do $test$
begin
 if to_regprocedure('public.fournisseur_reception_enregistrer(uuid,jsonb,text,text)') is null then raise exception 'RPC réception fournisseur absente'; end if;
 if has_function_privilege('anon','public.fournisseur_reception_enregistrer(uuid,jsonb,text,text)','EXECUTE') then raise exception 'RPC réception accessible à anon'; end if;
end;
$test$;
rollback;
