-- Contrats structurels Assurance / comptabilité. Exécuter sur Replay dans une transaction.
begin;
do $$
begin
  if to_regclass('public.assurance_conventions') is null
    or to_regclass('public.assurance_regles_convention') is null
    or to_regclass('public.assurance_reservation_snapshots') is null
    or to_regclass('public.assurance_evenements') is null
    or to_regclass('public.assurance_reglements') is null then
    raise exception 'ASSURANCE_TABLES_MISSING';
  end if;
  if exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in (
      'assurance_conventions','assurance_regles_convention',
      'assurance_reservation_snapshots','assurance_evenements','assurance_reglements'
    ) and c.relrowsecurity is not true
  ) then raise exception 'ASSURANCE_RLS_DISABLED'; end if;
  if has_table_privilege('authenticated','public.assurance_evenements','INSERT')
    or has_table_privilege('authenticated','public.assurance_reservation_snapshots','UPDATE')
    or has_table_privilege('authenticated','public.assurance_reglements','DELETE') then
    raise exception 'ASSURANCE_DIRECT_WRITE_GRANTED';
  end if;
  if not has_function_privilege('authenticated','public.assurance_calculer_devis(uuid,uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.assurance_valider_devis(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.assurance_confirmer_prise_en_charge(uuid,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.assurance_enregistrer_remboursement(uuid,bigint,date,text,text)','EXECUTE') then
    raise exception 'ASSURANCE_RPC_GRANT_MISSING';
  end if;
  if has_function_privilege('anon','public.assurance_calculer_devis(uuid,uuid)','EXECUTE')
    or has_function_privilege('anon','public.assurance_enregistrer_remboursement(uuid,bigint,date,text,text)','EXECUTE') then
    raise exception 'ASSURANCE_ANON_EXECUTE_GRANTED';
  end if;
  if position('assurance_prise_en_charge' in pg_get_functiondef('public.compta_traiter_evenement(uuid,uuid)'::regprocedure))=0
    or position('assurance_remboursement_recu' in pg_get_functiondef('public.compta_traiter_evenement(uuid,uuid)'::regprocedure))=0 then
    raise exception 'COMPTA_WORKER_ASSURANCE_UNSUPPORTED';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='dossiers_assurance' and column_name='montant_rembourse')
    or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='dossiers_assurance' and column_name='reservation_id') then
    raise exception 'DOSSIER_ASSURANCE_FINANCIAL_COLUMNS_MISSING';
  end if;
end
$$;
rollback;
