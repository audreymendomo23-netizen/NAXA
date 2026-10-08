-- NAXA ERP-003 — Test structurel POS étape 2
do $$
begin
 if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='vente_paiements') then raise exception 'vente_paiements absent'; end if;
 if not exists(select 1 from pg_proc where proname='vente_ajouter_paiement') then raise exception 'vente_ajouter_paiement absent'; end if;
 if not exists(select 1 from pg_proc where proname='vente_finaliser') then raise exception 'vente_finaliser absent'; end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='vente_paiements' and policyname='vente_paiements_scope') then raise exception 'RLS paiements absente'; end if;
end $$;
