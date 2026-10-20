begin;
do $test$
begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='fournisseurs' and policyname='fournisseurs_insert_staff' and cmd='INSERT') then
  raise exception 'Policy insert fournisseur réservée au personnel ERP absente';
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='fournisseurs' and policyname='fournisseurs_read_staff' and cmd='SELECT') then
  raise exception 'Policy lecture fournisseur réservée au personnel ERP absente';
 end if;
end;
$test$;
rollback;
