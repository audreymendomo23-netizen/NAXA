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
    or not has_function_privilege('authenticated','public.assurance_enregistrer_remboursement(uuid,bigint,date,text,text)','EXECUTE')
    or not has_function_privilege('authenticated','public.assurance_enregistrer_couverture(uuid,text,text,date,date,numeric,numeric)','EXECUTE') then
    raise exception 'ASSURANCE_RPC_GRANT_MISSING';
  end if;
  if has_function_privilege('anon','public.assurance_calculer_devis(uuid,uuid)','EXECUTE')
    or has_function_privilege('anon','public.assurance_enregistrer_remboursement(uuid,bigint,date,text,text)','EXECUTE')
    or has_function_privilege('anon','public.assurance_enregistrer_couverture(uuid,text,text,date,date,numeric,numeric)','EXECUTE') then
    raise exception 'ASSURANCE_ANON_EXECUTE_GRANTED';
  end if;
  if position('assurance_prise_en_charge' in pg_get_functiondef('public.compta_traiter_evenement(uuid,uuid)'::regprocedure))=0
    or position('assurance_remboursement_recu' in pg_get_functiondef('public.compta_traiter_evenement(uuid,uuid)'::regprocedure))=0 then
    raise exception 'COMPTA_WORKER_ASSURANCE_UNSUPPORTED';
  end if;
  if position('on conflict(pharmacie_id,cle_idempotence)' in pg_get_functiondef('private.assurance_lier_vente_reservation()'::regprocedure))=0
    or position('on conflict (pharmacie_id,cle_idempotence)' in pg_get_functiondef('public.assurance_enregistrer_remboursement(uuid,bigint,date,text,text)'::regprocedure))=0 then
    raise exception 'ASSURANCE_COMPTA_IDEMPOTENCE_KEY_MISMATCH';
  end if;
  if position('Répartition POS incohérente' in pg_get_functiondef('private.assurance_lier_vente_reservation()'::regprocedure))=0
    or position('vente_payer_assurance' in pg_get_functiondef('public.vente_reservation_encaisser(uuid,uuid,integer,text,text)'::regprocedure))=0
    or position('controle_documents_statut' in pg_get_functiondef('public.vente_reservation_encaisser(uuid,uuid,integer,text,text)'::regprocedure))=0
    or position('ASSURANCE:%' in pg_get_functiondef('public.compta_emettre_evenement_metier()'::regprocedure))=0 then
    raise exception 'ASSURANCE_POS_SPLIT_CONTRACT_MISSING';
  end if;
  if position('compta_evenement' in pg_get_functiondef('private.assurance_lier_vente_reservation()'::regprocedure))=0
    or position('compta_evenement' in pg_get_functiondef('public.assurance_confirmer_prise_en_charge(uuid,text)'::regprocedure))>0 then
    raise exception 'ASSURANCE_RECEIVABLE_RECOGNITION_TIMING_INVALID';
  end if;
  if not has_function_privilege('authenticated','public.assurance_configurer_convention(uuid,uuid,text,date,date,numeric,bigint,bigint)','EXECUTE')
    or position('v_rate:=v_rule.taux' in pg_get_functiondef('public.assurance_calculer_devis(uuid,uuid)'::regprocedure))=0
    or position('least(v_c.taux_prise_en_charge' in pg_get_functiondef('public.assurance_calculer_devis(uuid,uuid)'::regprocedure))>0
    or position('plafond=null' in pg_get_functiondef('public.assurance_enregistrer_couverture(uuid,text,text,date,date,numeric,numeric)'::regprocedure))=0 then
    raise exception 'ASSURANCE_PHARMACY_RATE_SOURCE_INVALID';
  end if;
  if not has_function_privilege('authenticated','public.assurance_enregistrer_regle(uuid,text,text,uuid,numeric,bigint,bigint,jsonb,jsonb,date,date)','EXECUTE')
    or has_function_privilege('anon','public.assurance_enregistrer_regle(uuid,text,text,uuid,numeric,bigint,bigint,jsonb,jsonb,date,date)','EXECUTE')
    or has_table_privilege('authenticated','public.assurance_regles_convention','INSERT')
    or (select relrowsecurity from pg_class where oid='public.assurance_regles_convention'::regclass) is not true then
    raise exception 'ASSURANCE_RULES_ACCESS_CONTROL_INVALID';
  end if;
  if position('private.naxa_scope_allows' in pg_get_functiondef('public.assurance_enregistrer_regle(uuid,text,text,uuid,numeric,bigint,bigint,jsonb,jsonb,date,date)'::regprocedure))=0
    or position('p_portee not in' in pg_get_functiondef('public.assurance_enregistrer_regle(uuid,text,text,uuid,numeric,bigint,bigint,jsonb,jsonb,date,date)'::regprocedure))=0
    or position('jsonb_typeof' in pg_get_functiondef('public.assurance_enregistrer_regle(uuid,text,text,uuid,numeric,bigint,bigint,jsonb,jsonb,date,date)'::regprocedure))=0 then
    raise exception 'ASSURANCE_RULES_VALIDATION_GUARD_MISSING';
  end if;
  if position('coalesce(vp.reference,' in pg_get_functiondef('public.compta_emettre_evenement_metier()'::regprocedure))=0
    or position('not like ''ASSURANCE:%''' in pg_get_functiondef('public.compta_emettre_evenement_metier()'::regprocedure))=0 then
    raise exception 'ASSURANCE_RECEIVABLE_COUNTED_AS_CASH';
  end if;
  if position('vp2.mode=''especes''' in pg_get_functiondef('public.caisse_cloturer(uuid,integer,text)'::regprocedure))=0 then
    raise exception 'ASSURANCE_RECEIVABLE_COUNTED_IN_CASH_CLOSING';
  end if;
  if position('assurance' in pg_get_functiondef('public.get_client_reservation_ticket(uuid)'::regprocedure))=0
    or position('reference' in pg_get_functiondef('public.get_client_reservation_ticket(uuid)'::regprocedure))=0 then
    raise exception 'ASSURANCE_CLIENT_RECEIPT_SPLIT_MISSING';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='dossiers_assurance' and column_name='montant_rembourse')
    or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='dossiers_assurance' and column_name='reservation_id') then
    raise exception 'DOSSIER_ASSURANCE_FINANCIAL_COLUMNS_MISSING';
  end if;
end
$$;
rollback;
