do $$ begin if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='pharmacies' and column_name='logo_url' and data_type='text') then raise exception 'pharmacies.logo_url absent ou type incorrect'; end if; end $$;
select '20261022130000_add_pharmacies_logo_url PASS' as resultat;
