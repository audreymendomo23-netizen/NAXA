do $$ begin
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='fournisseurs') then raise exception 'fournisseurs absent'; end if;
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='commandes_fournisseurs') then raise exception 'commandes absentes'; end if;
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='commandes_fournisseurs_lignes') then raise exception 'lignes commandes absentes'; end if;
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='receptions_fournisseurs') then raise exception 'receptions absentes'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='commandes_fournisseurs' and policyname='commandes_fournisseurs_scope') then raise exception 'RLS commandes absente'; end if;
end $$;