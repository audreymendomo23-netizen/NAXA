-- NAXA 225-227 — assertions de contrat de sécurité des affectations professionnelles.
-- Test de catalogue sans données métier ni écriture sur les comptes utilisateurs.
do $test$
declare
  v_rls boolean;
  v_helper text;
  v_grant text;
  v_revoke text;
  v_policy_count integer;
  v_lot text;
  v_inventory_line text;
  v_inventory_close text;
  v_offline text;
begin
  if to_regclass('public.naxa_professional_assignments') is null then
    raise exception 'FAIL: table naxa_professional_assignments absente';
  end if;

  select c.relrowsecurity into v_rls
  from pg_class c where c.oid = 'public.naxa_professional_assignments'::regclass;
  if v_rls is distinct from true then
    raise exception 'FAIL: RLS doit être activé';
  end if;

  if has_table_privilege('authenticated','public.naxa_professional_assignments','INSERT')
     or has_table_privilege('authenticated','public.naxa_professional_assignments','UPDATE')
     or has_table_privilege('authenticated','public.naxa_professional_assignments','DELETE') then
    raise exception 'FAIL: authenticated possède un droit d’écriture direct';
  end if;
  if not has_table_privilege('authenticated','public.naxa_professional_assignments','SELECT') then
    raise exception 'FAIL: lecture affectations non accordée au rôle authenticated';
  end if;

  select count(*) into v_policy_count
  from pg_policies
  where schemaname='public'
    and tablename='naxa_professional_assignments'
    and policyname='naxa_professional_assignments_participant_read'
    and cmd='SELECT';
  if v_policy_count <> 1 then
    raise exception 'FAIL: politique de lecture des participants absente';
  end if;

  select pg_get_functiondef('public.naxa_has_active_professional_assignment(uuid,uuid,text)'::regprocedure)
    into v_helper;
  if position('auth.uid()' in v_helper)=0 or position('is_admin' in v_helper)=0 then
    raise exception 'FAIL: helper sans restriction profil courant/Admin';
  end if;

  select pg_get_functiondef('public.naxa_grant_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text)'::regprocedure)
    into v_grant;
  if position('ASSIGN_USER_TO_PHARMACY' in v_grant)=0
     or position('expire_at' in v_grant)=0
     or position('p_target = v_actor' in v_grant)=0
     or position('for update' in lower(v_grant))=0
     or position('a.commence_at < p_expire_at' in v_grant)=0 then
    raise exception 'FAIL: garde de grant incomplète';
  end if;

  select pg_get_functiondef('public.naxa_revoke_professional_assignment(uuid,text)'::regprocedure)
    into v_revoke;
  if position('motif_revocation' in v_revoke)=0
     or position('revoque_par' in v_revoke)=0
     or position('revoque_at' in v_revoke)=0 then
    raise exception 'FAIL: révocation non auditée';
  end if;

  if not has_function_privilege('authenticated',
      'public.naxa_grant_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text)','EXECUTE')
     or not has_function_privilege('authenticated',
      'public.naxa_revoke_professional_assignment(uuid,text)','EXECUTE') then
    raise exception 'FAIL: RPC grant/révocation inaccessible à authenticated';
  end if;

  if has_function_privilege('anon',
      'public.naxa_grant_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text)','EXECUTE')
     or has_function_privilege('anon',
      'public.naxa_revoke_professional_assignment(uuid,text)','EXECUTE') then
    raise exception 'FAIL: RPC grant/révocation accessible à anon';
  end if;

  select pg_get_functiondef('public.stock_lot_enregistrer(uuid,uuid,text,date,integer,uuid)'::regprocedure)
    into v_lot;
  if position('naxa_has_active_professional_assignment' in v_lot)=0
     or position('v_assigned' in v_lot)=0
     or position('v_source.bloque' in v_lot)=0
     or position('v_source.quantite<p_quantite' in v_lot)=0
     or position('v_total_lots<>v_stock.quantite' in v_lot)=0 then
    raise exception 'FAIL: garde affectation ou contrôles métier de création de lot absents';
  end if;

  select pg_get_functiondef('public.inventaire_preparer_ligne(uuid,uuid,uuid)'::regprocedure)
    into v_inventory_line;
  if position('naxa_has_active_professional_assignment' in v_inventory_line)=0
     or position('v_assigned' in v_inventory_line)=0
     or position('sl.id=p_lot' in v_inventory_line)=0
     or position('on conflict(inventaire_id,produit_id,lot_id)' in lower(v_inventory_line))=0 then
    raise exception 'FAIL: garde affectation ou contrôles de préparation inventaire absents';
  end if;

  select pg_get_functiondef('public.inventaire_cloturer(uuid)'::regprocedure)
    into v_inventory_close;
  if position('naxa_has_active_professional_assignment' in v_inventory_close)=0
     or position('for update' in lower(v_inventory_close))=0
     or position('quantite_comptee is null' in lower(v_inventory_close))=0
     or (position('closed_by=auth.uid()' in lower(v_inventory_close))=0 and position('closed_by=v_user' in lower(v_inventory_close))=0) then
    raise exception 'FAIL: garde affectation ou contrôles de clôture inventaire absents';
  end if;

  select pg_get_functiondef('public.offline_stock_set_quantity(uuid,uuid,uuid,integer,timestamptz)'::regprocedure)
    into v_offline;
  if position('naxa_has_active_professional_assignment' in v_offline)=0
     or position('v_assigned' in v_offline)=0
     or position('created_by<>v_uid' in v_offline)=0
     or position('base_updated_at is distinct from p_base_updated_at' in lower(v_offline))=0
     or position('lotized_stock_requires_lot_operation' in v_offline)=0 then
    raise exception 'FAIL: garde affectation ou contrôles de synchronisation offline absents';
  end if;

  if position('naxa_has_active_professional_assignment' in pg_get_functiondef('public.naxa_stock_manager_actor(uuid)'::regprocedure))=0 then
    raise exception 'FAIL: helper Stock ne reconnait pas les affectations actives';
  end if;
  if position('naxa_has_active_professional_assignment' in pg_get_functiondef('public.fournisseur_reception_enregistrer(uuid,jsonb,text,text)'::regprocedure))=0
     or position('quantite_recue' in pg_get_functiondef('public.fournisseur_reception_enregistrer(uuid,jsonb,text,text)'::regprocedure))=0
     or position('v_lot_total<>v_stock.quantite' in pg_get_functiondef('public.fournisseur_reception_enregistrer(uuid,jsonb,text,text)'::regprocedure))=0 then
    raise exception 'FAIL: réception fournisseur sans garde affectation ou contrôles de cohérence';
  end if;
  if position('naxa_has_active_professional_assignment' in pg_get_functiondef('public.gestionnaire_stock_quantite_ajuster(uuid,uuid,integer,text,text,uuid)'::regprocedure))=0
     or position('v_motif' in pg_get_functiondef('public.gestionnaire_stock_quantite_ajuster(uuid,uuid,integer,text,text,uuid)'::regprocedure))=0
     or position('v_lot_total<>v_stock' in pg_get_functiondef('public.gestionnaire_stock_quantite_ajuster(uuid,uuid,integer,text,text,uuid)'::regprocedure))=0 then
    raise exception 'FAIL: ajustement Stock sans garde affectation ou contrôles de cohérence';
  end if;
  if not has_function_privilege('authenticated','public.fournisseur_reception_enregistrer(uuid,jsonb,text,text)','EXECUTE')
     or has_function_privilege('anon','public.fournisseur_reception_enregistrer(uuid,jsonb,text,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.gestionnaire_stock_quantite_ajuster(uuid,uuid,integer,text,text,uuid)','EXECUTE')
     or has_function_privilege('anon','public.gestionnaire_stock_quantite_ajuster(uuid,uuid,integer,text,text,uuid)','EXECUTE') then
    raise exception 'FAIL: ACL réception/ajustement incorrectes';
  end if;

  if position('naxa_has_active_professional_assignment' in pg_get_functiondef('public.stock_emplacement_modifier(uuid,uuid,text)'::regprocedure))=0
     or position('naxa_has_active_professional_assignment' in pg_get_functiondef('public.stock_lot_emplacement_modifier(uuid,text)'::regprocedure))=0
     or position('naxa_has_active_professional_assignment' in pg_get_functiondef('public.stock_lot_blocage_modifier(uuid,boolean,text)'::regprocedure))=0
     or position('naxa_has_active_professional_assignment' in pg_get_functiondef('public.gestionnaire_stock_reference_initialiser(uuid,uuid,integer,text)'::regprocedure))=0
     or position('naxa_has_active_professional_assignment' in pg_get_functiondef('public.gestionnaire_stock_transfert_atomique(uuid,uuid,uuid,integer,uuid,text)'::regprocedure))=0
     or position('naxa_has_active_professional_assignment' in pg_get_functiondef('public.gestionnaire_stock_service_ouvrir(uuid)'::regprocedure))=0 then
    raise exception 'FAIL: une opération emplacement/lot/service/transfert ignore les affectations';
  end if;
  if has_function_privilege('anon','public.stock_emplacement_modifier(uuid,uuid,text)','EXECUTE')
     or has_function_privilege('anon','public.stock_lot_emplacement_modifier(uuid,text)','EXECUTE')
     or has_function_privilege('anon','public.stock_lot_blocage_modifier(uuid,boolean,text)','EXECUTE')
     or has_function_privilege('anon','public.gestionnaire_stock_reference_initialiser(uuid,uuid,integer,text)','EXECUTE')
     or has_function_privilege('anon','public.gestionnaire_stock_transfert_atomique(uuid,uuid,uuid,integer,uuid,text)','EXECUTE')
     or has_function_privilege('anon','public.gestionnaire_stock_service_ouvrir(uuid)','EXECUTE') then
    raise exception 'FAIL: une RPC Stock/Lots est encore exécutable par anon';
  end if;

  if position('naxa_has_active_professional_assignment' in pg_get_functiondef('public.gestionnaire_stock_inventaire_demarrer(uuid,public.inventaire_type,text)'::regprocedure))=0
     or position('naxa_has_active_professional_assignment' in pg_get_functiondef('public.gestionnaire_stock_inventaire_ajouter_produit(uuid,uuid)'::regprocedure))=0
     or position('naxa_has_active_professional_assignment' in pg_get_functiondef('public.gestionnaire_stock_inventaire_compter(uuid,integer)'::regprocedure))=0
     or position('naxa_has_active_professional_assignment' in pg_get_functiondef('public.gestionnaire_stock_inventaire_annuler(uuid)'::regprocedure))=0 then
    raise exception 'FAIL: une opération d’inventaire transactionnel ignore les affectations';
  end if;
  if position('inventaire_ajustements' in pg_get_functiondef('public.inventaire_cloturer(uuid)'::regprocedure))=0
     or position('stocks_lots' in pg_get_functiondef('public.inventaire_cloturer(uuid)'::regprocedure))=0
     or position('quantite_comptee is null' in pg_get_functiondef('public.inventaire_cloturer(uuid)'::regprocedure))=0 then
    raise exception 'FAIL: la clôture transactionnelle ne conserve pas les ajustements/contrôles stock-lots';
  end if;
  if not has_function_privilege('authenticated','public.gestionnaire_stock_inventaire_demarrer(uuid,public.inventaire_type,text)','EXECUTE')
     or has_function_privilege('anon','public.gestionnaire_stock_inventaire_demarrer(uuid,public.inventaire_type,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.gestionnaire_stock_inventaire_compter(uuid,integer)','EXECUTE')
     or has_function_privilege('anon','public.gestionnaire_stock_inventaire_compter(uuid,integer)','EXECUTE') then
    raise exception 'FAIL: ACL inventaire transactionnel incorrectes';
  end if;
  if position('naxa_has_active_professional_assignment' in pg_get_functiondef('public.lot_quarantaine_compter(uuid,integer,integer)'::regprocedure))=0
     or has_function_privilege('anon','public.lot_quarantaine_compter(uuid,integer,integer)','EXECUTE') then
    raise exception 'FAIL: comptage de quarantaine sans garde affectation/ACL';
  end if;
  if position('naxa_has_active_professional_assignment' in pg_get_functiondef('public.partner_adjust_universe_stock(uuid,numeric,text,text)'::regprocedure))>0 then
    raise exception 'FAIL: le stock Marketplace partenaire a été mélangé au périmètre des pharmacies';
  end if;

  if position('naxa_has_active_professional_assignment' in pg_get_functiondef('public.stock_service_record_count(uuid,text,jsonb)'::regprocedure))=0
     or position('naxa_has_active_professional_assignment' in pg_get_functiondef('public.stock_service_close(uuid,text)'::regprocedure))=0 then
    raise exception 'FAIL: les opérations de service Stock ne revalident pas l’affectation active';
  end if;
  if not has_function_privilege('authenticated','public.stock_service_record_count(uuid,text,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.stock_service_record_count(uuid,text,jsonb)','EXECUTE')
     or not has_function_privilege('authenticated','public.stock_service_close(uuid,text)','EXECUTE')
     or has_function_privilege('anon','public.stock_service_close(uuid,text)','EXECUTE') then
    raise exception 'FAIL: ACL des opérations de service Stock incorrectes';
  end if;

  raise notice '225_professional_assignments_security PASS';
end
$test$;
