-- NAXA Comptable — chemin positif du worker, entièrement transactionnel.
-- À exécuter après le socle, l'outbox et le worker sur une base isolée.
-- Les comptes, paramètres, événements et écritures de fixture sont annulés par ROLLBACK.
begin;
select set_config('request.jwt.claim.role','service_role',true);

do $positive$
declare
  v_pharmacie uuid;
  v_actor uuid := gen_random_uuid();
  v_username text := 'cpta_pos_' || substr(replace(gen_random_uuid()::text,'-',''),1,16);
  v_periode uuid := gen_random_uuid();
  v_debit uuid := gen_random_uuid();
  v_credit uuid := gen_random_uuid();
  v_event uuid;
  v_claim uuid;
  v_claimed uuid;
  v_result text;
  v_status text;
  v_ecriture uuid;
  v_count integer;
  v_debits numeric;
  v_credits numeric;
begin
  select id into v_pharmacie from public.pharmacies order by id limit 1;
  if v_pharmacie is null then raise exception 'Fixture pharmacie absente'; end if;

  -- Profil technique temporaire requis pour les références de validation.
  set local session_replication_role = replica;
  insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
  values(v_actor,'authenticated','authenticated',v_username||'@invalid.local','',now(),now());
  set local session_replication_role = origin;
  insert into public.profiles(id,role,username,actif,pharmacie_id)
  values(v_actor,'admin',v_username,true,v_pharmacie);

  insert into public.compta_periodes(id,pharmacie_id,date_debut,date_fin,statut)
  values(v_periode,v_pharmacie,current_date-1,current_date+1,'ouverte');
  insert into public.compta_plan_comptable(
    id,pharmacie_id,code,libelle,classe,statut,source_validation,valide_par,valide_le
  ) values
    (v_debit,v_pharmacie,'TST-D-'||substr(replace(v_debit::text,'-',''),1,8),
      'Compte test débit',5,'valide','Test transactionnel worker',v_actor,now()),
    (v_credit,v_pharmacie,'TST-C-'||substr(replace(v_credit::text,'-',''),1,8),
      'Compte test crédit',7,'valide','Test transactionnel worker',v_actor,now());

  insert into public.compta_mapping_compte(
    pharmacie_id,evenement_type,sens,compte_id,statut,valide_du,valide_par,valide_le
  ) values
    (v_pharmacie,'vente_encaissee','debit',v_debit,'valide',current_date,v_actor,now()),
    (v_pharmacie,'vente_encaissee','credit',v_credit,'valide',current_date,v_actor,now());

  insert into public.compta_parametre(pharmacie_id,cle,valeur,statut,valide_du,valide_par)
  values(v_pharmacie,'journal_code.vente_encaissee',to_jsonb('VE'::text),'valide',current_date,v_actor);

  insert into public.compta_evenement(
    pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,date_evenement,donnees
  ) values (
    v_pharmacie,'vente_encaissee','vente','positive-worker-fixture',
    'positive-worker-fixture:vente_encaissee',now(),
    jsonb_build_object(
      'montant_fcfa','12500',
      'date_comptable',to_char(current_date,'YYYY-MM-DD'),
      'reference_source','POSITIVE-WORKER-TEST'
    )
  ) returning id into v_event;

  select c.event_id,c.claim_token into v_claimed,v_claim
  from public.compta_evenements_reclamer(100) c where c.event_id=v_event;
  if v_claimed is distinct from v_event or v_claim is null then
    raise exception 'Réclamation positive échouée';
  end if;
  select statut,claim_token into v_status,v_claim from public.compta_evenement where id=v_event;
  if v_status <> 'en_cours' then raise exception 'État après réclamation inattendu: %',v_status; end if;

  v_result := public.compta_traiter_evenement(v_event,v_claim);
  select statut into v_status from public.compta_evenement where id=v_event;
  select id into v_ecriture from public.compta_ecriture
    where pharmacie_id=v_pharmacie and cle_idempotence='positive-worker-fixture:vente_encaissee';
  if v_result <> 'traite' or v_status <> 'traite' or v_ecriture is null then
    raise exception 'Scénario positif non finalisé: résultat %, statut %, écriture %',
      v_result,v_status,v_ecriture;
  end if;

  select count(*),coalesce(sum(debit_fcfa),0),coalesce(sum(credit_fcfa),0)
    into v_count,v_debits,v_credits
  from public.compta_ligne where ecriture_id=v_ecriture;
  if v_count <> 2 or v_debits <> 12500 or v_credits <> 12500 then
    raise exception 'Écriture non équilibrée: lignes %, débit %, crédit %',v_count,v_debits,v_credits;
  end if;

  raise notice 'PASS worker positive: réclamation, traitement, écriture double équilibrée, finalisation';
end;
$positive$;

rollback;
select '163_compta_worker_positive PASS' as resultat;
