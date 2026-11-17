-- NAXA 302 — recette E2E transactionnelle des remboursements espèces / Orange / MTN.
-- Utilise des identités E2E déjà présentes sur Replay ; toute donnée créée est annulée.
begin;
select set_config('request.jwt.claim.sub','314ef1f3-7d48-4341-abee-f0c3bba53323',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $test$
declare
  v_pharmacie uuid := '76dd4983-273a-4a83-ae3d-9a7838d3aa35';
  v_actor uuid := '314ef1f3-7d48-4341-abee-f0c3bba53323';
  v_client uuid := 'dcb2242b-50fb-46c8-8c90-e01d42fa4175';
  v_caisse uuid := 'c3194cf5-7de3-4b90-9412-416b50e7ccbf';
  v_credit uuid; v_session uuid; v_cash_account uuid; v_orange_account uuid; v_mtn_account uuid;
  v_cash_op uuid; v_cash_retry uuid; v_orange_op uuid; v_mtn_op uuid;
  v_balance integer; v_operations integer; v_movements integer; v_message text;
begin
  if auth.uid() <> v_actor or not public.naxa_caisse_actor_for_pharmacy(v_pharmacie) then
    raise exception 'FAIL: acteur Caisse E2E non autorisé sur la pharmacie';
  end if;
  v_cash_account := public.tresorerie_creer_compte(v_pharmacie,'E2E 302 espèces','especes',0);
  perform public.caisse_credit_tresorerie_canal_configurer(v_pharmacie,'especes',v_cash_account);
  v_orange_account := public.tresorerie_creer_compte(v_pharmacie,'E2E 302 Orange Money','mobile_money',0);
  perform public.caisse_credit_tresorerie_canal_configurer(v_pharmacie,'orange_money',v_orange_account);
  v_mtn_account := public.tresorerie_creer_compte(v_pharmacie,'E2E 302 MTN MoMo','mobile_money',0);
  perform public.caisse_credit_tresorerie_canal_configurer(v_pharmacie,'mtn_momo',v_mtn_account);
  v_session := public.caisse_ouvrir(v_caisse,0);
  insert into public.client_credits(pharmacie_id,client_id,solde,plafond,actif,created_by)
  values(v_pharmacie,v_client,10000,10000,true,v_actor) returning id into v_credit;
  v_cash_op := public.client_credit_rembourser(v_credit,100,'especes',null,'Recette E2E espèces','30200000-0000-4000-8000-000000000001',false,false,false);
  v_cash_retry := public.client_credit_rembourser(v_credit,100,'especes',null,'Recette E2E espèces','30200000-0000-4000-8000-000000000001',false,false,false);
  if v_cash_op <> v_cash_retry then raise exception 'FAIL: rejeu espèces non idempotent'; end if;
  begin
    perform public.client_credit_rembourser(v_credit,101,'especes',null,'Recette E2E espèces','30200000-0000-4000-8000-000000000001',false,false,false);
    raise exception 'FAIL: clé idempotence réutilisée avec montant différent';
  exception when others then
    get stacked diagnostics v_message = message_text;
    if v_message = 'FAIL: clé idempotence réutilisée avec montant différent' then raise; end if;
  end;
  v_orange_op := public.client_credit_rembourser(v_credit,200,'orange_money','OM-E2E-302-01','Recette E2E Orange','30200000-0000-4000-8000-000000000002',true,true,true);
  v_mtn_op := public.client_credit_rembourser(v_credit,300,'mtn_momo','MTN-E2E-302-01','Recette E2E MTN','30200000-0000-4000-8000-000000000003',true,true,true);
  select solde into v_balance from public.client_credits where id=v_credit;
  if v_balance <> 9400 then raise exception 'FAIL: solde attendu 9400, obtenu %',v_balance; end if;
  select count(*) into v_operations from public.client_credit_operations where credit_id=v_credit and nature='remboursement';
  if v_operations <> 3 then raise exception 'FAIL: 3 remboursements uniques attendus, obtenu %',v_operations; end if;
  select count(*) into v_movements from public.tresorerie_mouvements where source_type='credit_remboursement' and source_id in (v_cash_op,v_orange_op,v_mtn_op);
  if v_movements <> 3 then raise exception 'FAIL: 3 mouvements atomiques attendus, obtenu %',v_movements; end if;
  select count(*) into v_operations from public.compta_evenement
   where evenement_type='credit_remboursement' and source_type='credit_operation'
     and source_id in (v_cash_op::text,v_orange_op::text,v_mtn_op::text);
  if v_operations <> 3 then raise exception 'FAIL: outbox comptable attendu une fois par remboursement, obtenu %',v_operations; end if;
  if (select count(distinct canal_paiement) from public.tresorerie_mouvements where source_type='credit_remboursement' and source_id in (v_cash_op,v_orange_op,v_mtn_op)) <> 3 then
    raise exception 'FAIL: canaux non distincts dans les mouvements';
  end if;
  if exists (select 1 from public.tresorerie_mouvements where source_type='credit_remboursement' and source_id in (v_cash_op,v_orange_op,v_mtn_op) and (nature <> 'encaissement' or origine <> 'comptoir')) then
    raise exception 'FAIL: nature ou origine de mouvement incorrecte';
  end if;
  if exists (select 1 from public.client_credit_operations where id in (v_orange_op,v_mtn_op) and (verification_beneficiaire is not true or verification_montant is not true or confirmation_client_vue is not true or verification_effectuee_par <> v_actor or verification_effectuee_at is null)) then
    raise exception 'FAIL: preuve visuelle mobile non persistée';
  end if;
  begin
    perform public.client_credit_rembourser(v_credit,50,'orange_money','OM-E2E-INVALID','Preuve absente','30200000-0000-4000-8000-000000000004',false,true,true);
    raise exception 'FAIL: remboursement mobile accepté sans preuve complète';
  exception when others then
    get stacked diagnostics v_message = message_text;
    if v_message = 'FAIL: remboursement mobile accepté sans preuve complète' then raise; end if;
  end;
  update public.tresorerie_comptes set canal_paiement=null where id=v_mtn_account;
  begin
    perform public.client_credit_rembourser(v_credit,50,'mtn_momo','MTN-E2E-NOMAP','Compte absent','30200000-0000-4000-8000-000000000005',true,true,true);
    raise exception 'FAIL: remboursement MTN accepté sans compte de trésorerie';
  exception when others then
    get stacked diagnostics v_message = message_text;
    if v_message = 'FAIL: remboursement MTN accepté sans compte de trésorerie' then raise; end if;
  end;
  select solde into v_balance from public.client_credits where id=v_credit;
  select count(*) into v_operations from public.client_credit_operations where credit_id=v_credit and nature='remboursement';
  select count(*) into v_movements from public.tresorerie_mouvements where source_type='credit_remboursement' and source_id in (v_cash_op,v_orange_op,v_mtn_op);
  if v_balance <> 9400 or v_operations <> 3 or v_movements <> 3 then raise exception 'FAIL: une tentative refusée a modifié solde/opérations/trésorerie'; end if;
  if has_function_privilege('anon','public.client_credit_rembourser(uuid,integer,mode_paiement_caisse,text,text,uuid,boolean,boolean,boolean)','EXECUTE')
     or not has_function_privilege('authenticated','public.client_credit_rembourser(uuid,integer,mode_paiement_caisse,text,text,uuid,boolean,boolean,boolean)','EXECUTE') then
    raise exception 'FAIL: ACL RPC incohérentes';
  end if;
end
$test$;
rollback;
select '302_caisse_credit_repayment_multichannel_e2e PASS — espèces + Orange + MTN + idempotence + preuve mobile + rollback des refus' as resultat;
