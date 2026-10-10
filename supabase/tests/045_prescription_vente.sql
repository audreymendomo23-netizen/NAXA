-- NAXA ERP-004 — Test structurel prescription -> vente
do $$
begin
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='prescriptions')
    then raise exception 'prescriptions absent'; end if;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='prescription_items')
    then raise exception 'prescription_items absent'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='prescriptions' and column_name='pharmacie_id')
    then raise exception 'prescriptions.pharmacie_id absent'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='prescriptions' and column_name='statut')
    then raise exception 'prescriptions.statut absent'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='ventes' and column_name='prescription_id')
    then raise exception 'ventes.prescription_id absent'; end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and tablename='ventes' and indexname='ventes_prescription_idx')
    then raise exception 'index vente ordonnance absent'; end if;
  if not exists (select 1 from pg_proc where proname='prescription_valider')
    then raise exception 'RPC prescription_valider absente'; end if;
  if not exists (select 1 from pg_trigger where tgname='trg_vente_prescription_guard')
    then raise exception 'garde vente ordonnance absente'; end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='prescriptions' and policyname='prescriptions_staff_read')
    then raise exception 'RLS coffre ordonnance absente'; end if;
end $$;

select '045_prescription_vente PASS' as resultat;
