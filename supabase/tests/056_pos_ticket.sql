-- NAXA ERP-003 — test structurel étape 3
select to_regclass('public.ventes') is not null as ventes_exists;
select exists(
  select 1 from information_schema.columns
  where table_schema='public' and table_name='ventes' and column_name='numero_vente'
) as numero_vente_exists;
select exists(
  select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='ventes_numero_vente_uq'
) as numero_unique_index_exists;
select exists(
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='vente_ticket'
) as ticket_rpc_exists;
select has_function_privilege('authenticated','public.vente_ticket(uuid)','EXECUTE') as authenticated_can_ticket;
select not has_function_privilege('anon','public.vente_ticket(uuid)','EXECUTE') as anon_cannot_ticket;
