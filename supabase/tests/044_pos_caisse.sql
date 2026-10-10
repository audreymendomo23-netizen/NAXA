-- NAXA ERP-003 — Test structurel POS
do $$
begin
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='caisses') then raise exception 'caisses absent'; end if;
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='caisses_sessions') then raise exception 'caisses_sessions absent'; end if;
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='ventes') then raise exception 'ventes absent'; end if;
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='vente_lignes') then raise exception 'vente_lignes absent'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='ventes' and column_name='total_net') then raise exception 'ventes.total_net absent'; end if;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='vente_lignes' and column_name='prix_unitaire') then raise exception 'vente_lignes.prix_unitaire absent'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='ventes' and policyname='ventes_scope') then raise exception 'RLS ventes absente'; end if;
end $$;

select '044_pos_caisse PASS' as resultat;
