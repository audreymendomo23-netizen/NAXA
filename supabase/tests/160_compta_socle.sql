-- NAXA Comptable — tests SQL du socle. Toutes les fixtures sont annulées par ROLLBACK.
begin;

do $setup$
declare
  v_uid uuid := gen_random_uuid();
  v_pharmacie uuid := gen_random_uuid();
  v_username text := 'cpta_' || substr(replace(gen_random_uuid()::text,'-',''),1,16);
  v_periode uuid := gen_random_uuid();
  v_periode_close uuid := gen_random_uuid();
  v_compte_a uuid := gen_random_uuid();
  v_compte_b uuid := gen_random_uuid();
  v_ecriture uuid := gen_random_uuid();
  v_rejected boolean;
  v_ok boolean;
begin
  if to_regclass('public.compta_periodes') is null
    or to_regclass('public.compta_parametre') is null
    or to_regclass('public.compta_mapping_compte') is null
    or to_regclass('public.compta_evenement') is null
    or to_regclass('public.compta_ecriture') is null
    or to_regclass('public.compta_ligne') is null
    or to_regclass('public.compta_audit') is null then
    raise exception 'Socle comptable incomplet';
  end if;

  -- Compte et pharmacie de test strictement éphémères.
  set local session_replication_role = replica;
  insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
  values(v_uid,'authenticated','authenticated',v_username||'@invalid.local','',now(),now());
  set local session_replication_role = origin;
  insert into public.profiles(id,role,username,actif)
  values(v_uid,'admin',v_username,true);
  insert into public.pharmacies(id,nom,lat,lng)
  values(v_pharmacie,'NAXA TEST COMPTA',3.8667,11.5167);

  insert into public.compta_periodes(id,pharmacie_id,date_debut,date_fin)
  values(v_periode,v_pharmacie,current_date-10,current_date+10);
  insert into public.compta_periodes(id,pharmacie_id,date_debut,date_fin)
  values(v_periode_close,v_pharmacie,current_date-40,current_date-20);

  insert into public.compta_plan_comptable(id,pharmacie_id,code,libelle,classe,statut,source_validation,valide_par,valide_le)
  values
    (v_compte_a,v_pharmacie,'TEST-A','Compte technique A',1,'valide','Fixture SQL',v_uid,now()),
    (v_compte_b,v_pharmacie,'TEST-B','Compte technique B',1,'valide','Fixture SQL',v_uid,now());

  -- 1. Une écriture déséquilibrée doit être rejetée à la fin de transaction.
  v_rejected := false;
  begin
    insert into public.compta_ecriture(
      id,pharmacie_id,periode_id,journal_code,date_ecriture,source_type,source_id,cle_idempotence,libelle
    ) values(v_ecriture,v_pharmacie,v_periode,'TEST',current_date,'test','unbalanced','test-unbalanced-0001','Écriture de test');
    insert into public.compta_ligne(ecriture_id,pharmacie_id,compte_id,libelle,debit_fcfa,credit_fcfa)
    values(v_ecriture,v_pharmacie,v_compte_a,'Débit test',100,0);
    set constraints compta_ecriture_balance_deferred, compta_ligne_balance_deferred immediate;
  exception when others then
    v_rejected := true;
  end;
  set constraints all deferred;
  if not v_rejected then raise exception 'Échec test : écriture déséquilibrée acceptée'; end if;

  -- 2. Une écriture datée dans une période clôturée doit être refusée.
  update public.compta_periodes
    set statut='cloturee',cloturee_par=v_uid,cloturee_le=now()
    where id=v_periode_close;
  v_rejected := false;
  begin
    insert into public.compta_ecriture(
      pharmacie_id,periode_id,journal_code,date_ecriture,source_type,source_id,cle_idempotence,libelle
    ) values(v_pharmacie,v_periode_close,'TEST',current_date-30,'test','closed','test-closed-0001','Écriture clôturée');
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'Échec test : écriture en période clôturée acceptée'; end if;

  -- 3. Événement dupliqué : l'idempotence est garantie par contrainte unique.
  insert into public.compta_evenement(
    pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,date_evenement
  ) values(v_pharmacie,'vente_payee','vente','test-vente-1','test-event-0001',now());
  v_rejected := false;
  begin
    insert into public.compta_evenement(
      pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,date_evenement
    ) values(v_pharmacie,'vente_payee','vente','test-vente-1','test-event-0001',now());
  exception when unique_violation then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'Échec test : événement dupliqué accepté'; end if;

  -- 4. Une écriture enregistrée est immuable ; la correction est une contre-passation.
  v_ecriture := gen_random_uuid();
  insert into public.compta_ecriture(
    id,pharmacie_id,periode_id,journal_code,date_ecriture,source_type,source_id,cle_idempotence,libelle
  ) values(v_ecriture,v_pharmacie,v_periode,'TEST',current_date,'test','balanced','test-balanced-0001','Écriture équilibrée');
  insert into public.compta_ligne(ecriture_id,pharmacie_id,compte_id,libelle,debit_fcfa,credit_fcfa)
  values
    (v_ecriture,v_pharmacie,v_compte_a,'Débit test',100,0),
    (v_ecriture,v_pharmacie,v_compte_b,'Crédit test',0,100);
  set constraints compta_ecriture_balance_deferred, compta_ligne_balance_deferred immediate;
  set constraints all deferred;
  v_rejected := false;
  begin
    update public.compta_ecriture set libelle='Modification interdite' where id=v_ecriture;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'Échec test : écriture immuable modifiée'; end if;
  v_rejected := false;
  begin
    delete from public.compta_ecriture where id=v_ecriture;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'Échec test : écriture immuable supprimée'; end if;

  -- 5. Audit chaîné valide puis corruption détectée par le vérificateur.
  perform public.compta_auditer(v_pharmacie,v_uid,'test_creation','ecriture','fixture-1','succes',null);
  perform public.compta_auditer(v_pharmacie,v_uid,'test_export','rapport','fixture-2','succes','test');
  select public.compta_verifier_audit(v_pharmacie) into v_ok;
  if not v_ok then raise exception 'Échec test : chaîne d’audit valide déclarée invalide'; end if;
  alter table public.compta_audit disable trigger all;
  update public.compta_audit set hash_payload='{"tampered":true}'::jsonb
    where pharmacie_id=v_pharmacie and sequence_no=1;
  alter table public.compta_audit enable trigger all;
  select public.compta_verifier_audit(v_pharmacie) into v_ok;
  if v_ok then raise exception 'Échec test : altération de la chaîne non détectée'; end if;

  -- 6. Aucun droit direct de mutation comptable pour les rôles clients.
  if has_function_privilege('authenticated','public.compta_poster_ecriture(uuid,uuid,date,text,text,text,text,text,jsonb,uuid)','EXECUTE')
    or has_table_privilege('authenticated','public.compta_ecriture','INSERT')
    or has_table_privilege('authenticated','public.compta_ecriture','UPDATE')
    or has_table_privilege('authenticated','public.compta_ecriture','DELETE')
    or has_table_privilege('anon','public.compta_ecriture','SELECT')
    or has_table_privilege('authenticated','public.compta_ligne','INSERT')
    or has_table_privilege('authenticated','public.compta_audit','UPDATE') then
    raise exception 'Échec test : privilèges directs trop larges';
  end if;
end
$setup$;

rollback;
select '160_compta_socle PASS (à exécuter dans une base de test Supabase)' as resultat;
