begin;
do $test$
begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='produits' and column_name='sur_ordonnance' and data_type='boolean') then raise exception 'produits.sur_ordonnance absent'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='produits' and column_name='fabricant' and data_type='text') then raise exception 'produits.fabricant absent'; end if;
end;
$test$;
select true as naxa_076_produits_metadata_pass;
rollback;
