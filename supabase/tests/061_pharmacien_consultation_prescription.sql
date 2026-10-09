-- NAXA test structurel — Pharmacien : consultation + prescription
select to_regclass('public.consultations_pharmaceutiques') is not null as consultations_table_exists;
select exists(select 1 from information_schema.columns where table_schema='public' and table_name='prescriptions' and column_name='consultation_id') as prescription_consultation_fk_exists;
select exists(select 1 from information_schema.columns where table_schema='public' and table_name='prescription_items' and column_name='posologie') as prescription_posologie_exists;
select exists(select 1 from information_schema.columns where table_schema='public' and table_name='prescription_items' and column_name='duree') as prescription_duree_exists;
select exists(select 1 from information_schema.columns where table_schema='public' and table_name='prescription_items' and column_name='instructions') as prescription_instructions_exists;
select exists(select 1 from information_schema.routines where routine_schema='public' and routine_name='pharmacien_creer_consultation') as consultation_rpc_exists;
select exists(select 1 from information_schema.routines where routine_schema='public' and routine_name='pharmacien_creer_prescription') as prescription_rpc_exists;
select exists(select 1 from information_schema.routines where routine_schema='public' and routine_name='pharmacien_prescriptions_recentes') as recent_prescriptions_rpc_exists;
select exists(select 1 from pg_policies where schemaname='public' and tablename='consultations_pharmaceutiques' and policyname='consultations_pharmacien_read') as consultation_rls_exists;
select exists(select 1 from public.naxa_privileges where code='CREATE_PHARMACY_CONSULTATION' and active) as consultation_privilege_exists;
select exists(select 1 from public.naxa_privileges where code='CREATE_PHARMACY_PRESCRIPTION' and active) as prescription_privilege_exists;
