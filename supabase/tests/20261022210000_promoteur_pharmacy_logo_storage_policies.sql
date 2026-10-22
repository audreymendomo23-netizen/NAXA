-- Run manually as a read-only schema assertion; not executed against the test project.
do $$ begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='pharmacies' and column_name='logo_url' and data_type='text') then raise exception 'pharmacies.logo_url text column missing'; end if;
 if not exists(select 1 from storage.buckets where id='pharmacies-photos' and public is true and file_size_limit<=524288) then raise exception 'pharmacies-photos bucket configuration missing'; end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='promoteur_pharmacy_logo_insert' and cmd='INSERT') then raise exception 'logo insert policy missing'; end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='promoteur_pharmacy_logo_update' and cmd='UPDATE') then raise exception 'logo update policy missing'; end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='promoteur_pharmacy_logo_delete' and cmd='DELETE') then raise exception 'logo delete policy missing'; end if;
end $$;
