-- Tests structurels et fonctionnels du worker Comptable.
-- À exécuter après le socle, l'outbox et la migration worker, sur une base de test.
begin;

do $test$
declare
  v_pharmacie uuid;
  v_event uuid;
  v_claimed_event uuid;
  v_token uuid;
  v_result text;
  v_status text;
  v_code text;
  v_rejected boolean := false;
begin
  if to_regprocedure('public.compta_traiter_evenement(uuid,uuid)') is null then
    raise exception 'RPC compta_traiter_evenement absente';
  end if;
  if has_function_privilege('authenticated','public.compta_traiter_evenement(uuid,uuid)','EXECUTE') then
    raise exception 'authenticated peut invoquer le worker comptable';
  end if;
  if not has_function_privilege('service_role','public.compta_traiter_evenement(uuid,uuid)','EXECUTE') then
    raise exception 'service_role ne peut pas invoquer le worker comptable';
  end if;
  if to_regclass('public.compta_mapping_compte') is null
     or to_regclass('public.compta_parametre') is null
     or to_regclass('public.compta_periodes') is null then
    raise exception 'Référentiels comptables nécessaires au worker absents';
  end if;
end;
$test$;

-- Exercice transactionnel sur une pharmacie de test existante. Tout est annulé
-- en fin de fichier : aucun événement de test ne reste en base.
select set_config('request.jwt.claim.role','service_role',true);

do $functional$
declare
  v_pharmacie uuid;
  v_event uuid;
  v_claimed_event uuid;
  v_token uuid;
  v_result text;
  v_status text;
  v_code text;
  v_rejected boolean := false;
begin
  select p.id into v_pharmacie from public.pharmacies p order by p.id limit 1;
  if v_pharmacie is null then
    raise notice 'SKIP test fonctionnel : aucune pharmacie de fixture disponible';
    return;
  end if;

  insert into public.compta_evenement(
    pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,
    date_evenement,donnees
  ) values (
    v_pharmacie,'vente_encaissee','vente','worker-test-no-mapping',
    'worker-test-no-mapping:vente_encaissee',now(),
    jsonb_build_object(
      'montant_fcfa','12500',
      'date_comptable',to_char(timezone('Africa/Douala',now())::date,'YYYY-MM-DD'),
      'reference_source','TEST-WORKER'
    )
  ) returning id into v_event;

  select c.event_id,c.claim_token into v_claimed_event,v_token
  from public.compta_evenements_reclamer(1) c
  where c.event_id=v_event;

  if v_claimed_event is distinct from v_event or v_token is null then
    raise exception 'Échec de la réclamation ou absence de jeton de verrouillage';
  end if;

  begin
    perform public.compta_evenement_terminer(v_event,v_token,true,null);
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'Le worker a pu finaliser un événement sans écriture correspondante';
  end if;

  v_result := public.compta_traiter_evenement(v_event,v_token);
  select e.statut,e.code_erreur into v_status,v_code
  from public.compta_evenement e where e.id=v_event;

  if v_result <> 'a_traiter' or v_status <> 'a_traiter'
     or v_code not like 'worker_%' then
    raise exception 'Échec du chemin de reprise sécurisé : résultat %, statut %, code %',
      v_result,v_status,v_code;
  end if;
  if exists (
    select 1 from public.compta_ecriture e
    where e.pharmacie_id=v_pharmacie
      and e.cle_idempotence='worker-test-no-mapping:vente_encaissee'
  ) then
    raise exception 'Une écriture a été créée malgré l’absence de période/mappings validés';
  end if;

  raise notice 'PASS worker : réclamation, jeton, finalisation prématurée refusée, absence de configuration sans écriture, reprise et code technique assaini';
end;
$functional$;

rollback;
