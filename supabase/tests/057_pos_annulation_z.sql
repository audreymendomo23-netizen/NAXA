-- NAXA ERP-003 — test structurel étapes 4/5/6
select to_regclass('public.vente_annulation_demandes') is not null as annulation_table_exists;
select exists(
  select 1 from pg_indexes
  where schemaname='public' and indexname='vente_annulation_demandes_active_uq'
) as annulation_active_unique_exists;
select exists(
  select 1 from pg_indexes
  where schemaname='public' and indexname='caisses_sessions_caisse_ouverte_uq'
) as open_session_unique_exists;
select has_function_privilege('authenticated','public.vente_annulation_demander(uuid,text)','EXECUTE') as authenticated_can_request_cancel;
select has_function_privilege('authenticated','public.vente_annulation_decider(uuid,boolean)','EXECUTE') as authenticated_can_decide_cancel;
select has_function_privilege('authenticated','public.vente_annuler(uuid)','EXECUTE') as authenticated_can_cancel;
select has_function_privilege('anon','public.vente_annuler(uuid)','EXECUTE') = false as anon_cannot_cancel;
select has_function_privilege('authenticated','public.caisse_cloturer(uuid,integer)','EXECUTE') as authenticated_can_close_z;
select has_function_privilege('anon','public.caisse_cloturer(uuid,integer)','EXECUTE') = false as anon_cannot_close_z;
select exists(
  select 1 from pg_constraint
  where conrelid='public.caisses_sessions'::regclass
    and conname='caisses_sessions_caisse_id_key'
) = false as old_single_session_constraint_removed;
