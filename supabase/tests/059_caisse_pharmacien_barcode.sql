-- NAXA test structurel — Caisse barcode/emplacement + Pharmacien
select to_regclass('public.vente_paiements') is not null as vente_paiements_exists;
select to_regclass('public.prescriptions') is not null as prescriptions_exists;
select exists(select 1 from information_schema.columns where table_schema='public' and table_name='produits' and column_name='code_barre') as produits_code_barre_exists;
select exists(select 1 from information_schema.columns where table_schema='public' and table_name='stocks' and column_name='emplacement') as stocks_emplacement_exists;
select exists(select 1 from information_schema.columns where table_schema='public' and table_name='vente_paiements' and column_name='montant_percu') as paiement_montant_percu_exists;
select exists(select 1 from information_schema.routines where routine_schema='public' and routine_name='caisse_rechercher_codes') as bulk_lookup_exists;
select exists(select 1 from information_schema.routines where routine_schema='public' and routine_name='vente_encaisser') as encaissement_exists;
select exists(select 1 from information_schema.routines where routine_schema='public' and routine_name='prescription_valider') as pharmacist_validation_rpc_exists;
select exists(select 1 from pg_constraint where conname='profiles_fonction_interne_check') as fonction_interne_constraint_exists;
