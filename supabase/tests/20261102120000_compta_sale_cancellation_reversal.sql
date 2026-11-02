-- NAXA Comptable — contrepassation exacte d'une vente POS annulée.
-- Le worker écrit un nouvel enregistrement miroir; l'écriture originale reste immuable.
-- Tout le scénario est annulé par ROLLBACK.

begin;

set local session_replication_role = replica;
insert into public.pharmacies(id,nom,ville,lat,lng,actif,est_demo,visible_recherche)
values (
  '01900000-0000-4000-8000-000000000101',
  'NAXA Comptabilité test contrepassation',
  'Yaoundé',3.85,11.50,true,true,false
);

insert into auth.users(instance_id,id,aud,role,email,raw_user_meta_data,created_at,updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  '01900000-0000-4000-8000-000000000001',
  'authenticated','authenticated',
  'naxa-compta-reversal@example.invalid',
  '{"naxa_signup_pending":true}'::jsonb,
  now(),now()
);

insert into public.profiles(id,role,username,actif,niveau_interne,pharmacie_id)
values (
  '01900000-0000-4000-8000-000000000001',
  'admin','naxa_compta_reversal',true,1,
  '01900000-0000-4000-8000-000000000101'
);
set local session_replication_role = origin;

insert into public.compta_periodes(id,pharmacie_id,date_debut,date_fin,statut)
values (
  '01900000-0000-4000-8000-000000000201',
  '01900000-0000-4000-8000-000000000101',
  current_date-1,current_date+1,'ouverte'
);

insert into public.compta_plan_comptable(
  id,pharmacie_id,code,libelle,classe,statut,source_validation,valide_par,valide_le
) values
(
  '01900000-0000-4000-8000-000000000301',
  '01900000-0000-4000-8000-000000000101',
  'REV-DEBIT','Compte de débit test',5,'valide',
  'Test transactionnel de contrepassation',
  '01900000-0000-4000-8000-000000000001',now()
),
(
  '01900000-0000-4000-8000-000000000302',
  '01900000-0000-4000-8000-000000000101',
  'REV-CREDIT','Compte de crédit test',7,'valide',
  'Test transactionnel de contrepassation',
  '01900000-0000-4000-8000-000000000001',now()
);

insert into public.compta_parametre(
  pharmacie_id,cle,valeur,statut,valide_du,valide_par
) values (
  '01900000-0000-4000-8000-000000000101',
  'journal_code.vente_annulee',
  to_jsonb('OD'::text),'valide',current_date,
  '01900000-0000-4000-8000-000000000001'
);

insert into public.compta_ecriture(
  id,pharmacie_id,periode_id,journal_code,date_ecriture,
  source_type,source_id,cle_idempotence,libelle,cree_par
) values (
  '01900000-0000-4000-8000-000000000401',
  '01900000-0000-4000-8000-000000000101',
  '01900000-0000-4000-8000-000000000201',
  'VE',current_date,'vente',
  '01900000-0000-4000-8000-000000000501',
  'vente:01900000-0000-4000-8000-000000000501:vente_encaissee',
  'Vente POS originale de test',
  '01900000-0000-4000-8000-000000000001'
);

insert into public.compta_ligne(
  ecriture_id,pharmacie_id,compte_id,libelle,debit_fcfa,credit_fcfa
) values
(
  '01900000-0000-4000-8000-000000000401',
  '01900000-0000-4000-8000-000000000101',
  '01900000-0000-4000-8000-000000000301',
  'Encaissement original',12500,0
),
(
  '01900000-0000-4000-8000-000000000401',
  '01900000-0000-4000-8000-000000000101',
  '01900000-0000-4000-8000-000000000302',
  'Produit de vente original',0,12500
);

insert into public.compta_evenement(
  id,pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,date_evenement,donnees
) values (
  '01900000-0000-4000-8000-000000000601',
  '01900000-0000-4000-8000-000000000101',
  'vente_annulee','vente_annulation',
  '01900000-0000-4000-8000-000000000701',
  'vente_annulation:01900000-0000-4000-8000-000000000701:vente_annulee',
  now(),
  jsonb_build_object(
    'vente_id','01900000-0000-4000-8000-000000000501',
    'annulation_demande_id','01900000-0000-4000-8000-000000000701',
    'montant_fcfa','12500',
    'date_comptable',to_char(timezone('Africa/Douala',now())::date,'YYYY-MM-DD'),
    'reference_source','NAXA-REVERSAL-TEST'
  )
);

select set_config('request.jwt.claim.role','service_role',true);
select set_config('request.jwt.claims','{"role":"service_role"}',true);

do $test$
declare
  v_claim_token uuid;
  v_result text;
  v_event_status text;
  v_reversal uuid;
  v_reversal_again uuid;
  v_count integer;
  v_debit numeric;
  v_credit numeric;
  v_original_unchanged boolean;
  v_duplicate_rejected boolean:=false;
begin
  select c.claim_token into v_claim_token
  from public.compta_evenements_reclamer(10) c
  where c.event_id='01900000-0000-4000-8000-000000000601';

  if v_claim_token is null then
    raise exception 'E19 FAIL: cancellation event was not claimed';
  end if;

  v_result := public.compta_traiter_evenement(
    '01900000-0000-4000-8000-000000000601',v_claim_token
  );

  select statut into v_event_status
  from public.compta_evenement
  where id='01900000-0000-4000-8000-000000000601';

  select id into v_reversal
  from public.compta_ecriture
  where pharmacie_id='01900000-0000-4000-8000-000000000101'
    and cle_idempotence='vente_annulation:01900000-0000-4000-8000-000000000701:vente_annulee';

  if v_result<>'traite' or v_event_status<>'traite' or v_reversal is null then
    raise exception 'E19 FAIL: cancellation not posted; worker %, event %, reversal %',
      v_result,v_event_status,v_reversal;
  end if;

  if not exists(
    select 1 from public.compta_ecriture
    where id=v_reversal and contrepassation_de='01900000-0000-4000-8000-000000000401'
      and source_type='vente_annulation'
      and source_id='01900000-0000-4000-8000-000000000701'
  ) then
    raise exception 'E19 FAIL: contra-passation link/source missing';
  end if;

  select count(*),coalesce(sum(debit_fcfa),0),coalesce(sum(credit_fcfa),0)
  into v_count,v_debit,v_credit
  from public.compta_ligne where ecriture_id=v_reversal;

  if v_count<>2 or v_debit<>12500 or v_credit<>12500
     or not exists(select 1 from public.compta_ligne where ecriture_id=v_reversal
       and compte_id='01900000-0000-4000-8000-000000000301' and credit_fcfa=12500 and debit_fcfa=0)
     or not exists(select 1 from public.compta_ligne where ecriture_id=v_reversal
       and compte_id='01900000-0000-4000-8000-000000000302' and debit_fcfa=12500 and credit_fcfa=0) then
    raise exception 'E19 FAIL: reversal lines are not exact inverse; count %, debit %, credit %',
      v_count,v_debit,v_credit;
  end if;

  select (e.periode_id='01900000-0000-4000-8000-000000000201'
          and e.date_ecriture=current_date
          and e.journal_code='OD'
          and e.libelle='Contrepassation de la vente 01900000-0000-4000-8000-000000000501')
    into v_original_unchanged
  from public.compta_ecriture e
  where e.id=v_reversal;
  if not v_original_unchanged then
    raise exception 'E19 FAIL: reversal metadata not preserved';
  end if;

  v_reversal_again := public.compta_poster_contrepassation(
    '01900000-0000-4000-8000-000000000101',
    '01900000-0000-4000-8000-000000000201',
    current_date,'OD',
    '01900000-0000-4000-8000-000000000401',
    '01900000-0000-4000-8000-000000000701',
    'vente_annulation:01900000-0000-4000-8000-000000000701:vente_annulee',
    'Contrepassation de la vente 01900000-0000-4000-8000-000000000501',
    null
  );
  if v_reversal_again is distinct from v_reversal then
    raise exception 'E19 FAIL: identical retry was not idempotent';
  end if;

  begin
    perform public.compta_poster_contrepassation(
      '01900000-0000-4000-8000-000000000101',
      '01900000-0000-4000-8000-000000000201',
      current_date,'OD',
      '01900000-0000-4000-8000-000000000401',
      '01900000-0000-4000-8000-000000000702',
      'vente_annulation:01900000-0000-4000-8000-000000000702:vente_annulee',
      'Second reversal must fail',null
    );
  exception when others then
    v_duplicate_rejected:=true;
  end;

  if not v_duplicate_rejected then
    raise exception 'E19 FAIL: a second reversal for the same source was accepted';
  end if;

  if (select count(*) from public.compta_ecriture
      where contrepassation_de='01900000-0000-4000-8000-000000000401')<>1 then
    raise exception 'E19 FAIL: more than one reversal exists';
  end if;
end;
$test$;

rollback;
select 'E19 POS sale cancellation accounting reversal PASS (exact inverse, immutable source, idempotent, one reversal)' as resultat;
