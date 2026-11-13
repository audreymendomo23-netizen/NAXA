begin;

do $test$
declare
  v_confirm text;
  v_submit text;
  v_add_reference text;
  v_status_check text;
  v_unique text;
  v_devices_rls boolean;
  v_events_rls boolean;
  v_evidence_rls boolean;
begin
  if to_regclass('public.naxa_admin_payment_devices') is null
     or to_regclass('public.naxa_admin_payment_capture_events') is null
     or to_regclass('public.naxa_promoteur_payment_sms_evidence') is null then
    raise exception 'Tables de collecte ou preuves SMS absentes';
  end if;

  select relrowsecurity into v_devices_rls
  from pg_class where oid='public.naxa_admin_payment_devices'::regclass;
  select relrowsecurity into v_events_rls
  from pg_class where oid='public.naxa_admin_payment_capture_events'::regclass;
  select relrowsecurity into v_evidence_rls
  from pg_class where oid='public.naxa_promoteur_payment_sms_evidence'::regclass;
  if v_devices_rls is not true or v_events_rls is not true or v_evidence_rls is not true then
    raise exception 'RLS absente sur les tables de preuve SMS';
  end if;

  if has_table_privilege('anon','public.naxa_promoteur_payment_sms_evidence','SELECT')
     or has_table_privilege('authenticated','public.naxa_promoteur_payment_sms_evidence','SELECT')
     or has_table_privilege('anon','public.naxa_promoteur_payment_sms_evidence','INSERT')
     or has_table_privilege('authenticated','public.naxa_promoteur_payment_sms_evidence','INSERT') then
    raise exception 'La table des deux preuves SMS est directement accessible au client';
  end if;
  if not has_table_privilege('service_role','public.naxa_promoteur_payment_sms_evidence','SELECT')
     or not has_table_privilege('service_role','public.naxa_promoteur_payment_sms_evidence','INSERT') then
    raise exception 'service_role ne peut pas gérer les deux preuves SMS';
  end if;

  if has_table_privilege('anon','public.naxa_admin_payment_devices','SELECT')
     or has_table_privilege('authenticated','public.naxa_admin_payment_devices','SELECT')
     or has_table_privilege('anon','public.naxa_admin_payment_capture_events','SELECT')
     or has_table_privilege('authenticated','public.naxa_admin_payment_capture_events','SELECT') then
    raise exception 'Les tables Admin sont directement lisibles par le client';
  end if;
  if not has_table_privilege('service_role','public.naxa_admin_payment_devices','SELECT')
     or not has_table_privilege('service_role','public.naxa_admin_payment_capture_events','SELECT') then
    raise exception 'service_role ne peut pas lire les tables Admin';
  end if;

  if has_function_privilege('anon','public.naxa_promoteur_payment_auto_confirm_admin_sms(uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.naxa_promoteur_payment_auto_confirm_admin_sms(uuid)','EXECUTE')
     or not has_function_privilege('service_role','public.naxa_promoteur_payment_auto_confirm_admin_sms(uuid)','EXECUTE') then
    raise exception 'ACL de la RPC de confirmation Admin invalides';
  end if;

  select pg_get_functiondef('public.naxa_promoteur_payment_auto_confirm_admin_sms(uuid)'::regprocedure)
  into v_confirm;
  if position('service_role' in v_confirm)=0
     or position('merchant_credit' in v_confirm)=0
     or position('payer_number' in v_confirm)=0
     or position('destination_snapshot' in v_confirm)=0
     or position('admin_confirmer_reglement_promoteur' in v_confirm)=0
     or position('verification_deadline_at' in v_confirm)=0
     or position('naxa_promoteur_payment_sms_evidence' in v_confirm)=0
     or position('merchantSmsSenderIdUsedOnlyForCollectionFilter' in v_confirm)=0
     or position('e.sender_origin_id <>' in v_confirm)>0
     or position('e.sender_origin_id ~' in v_confirm)>0
     or position('interval ''30 minutes''' in v_confirm)=0
     or position('interval ''15 minutes''' in v_confirm)=0 then
    raise exception 'La RPC ne respecte pas les contrôles ou dépend encore du libellé expéditeur';
  end if;

  if position('payer.source_type=''payer_sms''' in replace(v_confirm,' ',''))=0
     or position('merchant.source_type=''merchant_sms''' in replace(v_confirm,' ',''))=0
     or position('merchant.reference_claim_id=payer.reference_claim_id' in replace(v_confirm,' ',''))=0
     or position('merchant.reference_normalisee=payer.reference_normalisee' in replace(v_confirm,' ',''))=0
     or position('payer.reference_normalisee=e.reference_normalisee' in replace(v_confirm,' ',''))=0
     or position('payer.payload_sha256<>merchant.payload_sha256' in replace(v_confirm,' ',''))=0 then
    raise exception 'La confirmation ne requiert pas deux SMS distincts portant le même ID transaction';
  end if;

  select pg_get_functiondef(
    'public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text,jsonb)'::regprocedure
  ) into v_submit;
  if position('naxa_promoteur_payment_sms_evidence' in v_submit)=0
     or position('payer_sms' in v_submit)=0
     or position('smsPayloadSha256' in v_submit)=0
     or position('sourceType' in v_submit)=0 then
    raise exception 'Le SMS débit payeur ne crée pas sa preuve indépendante';
  end if;

  select pg_get_functiondef(
    'public.naxa_promoteur_payment_add_reference(uuid,text,text,smallint,text,timestamptz,timestamptz,text)'::regprocedure
  ) into v_add_reference;
  if position('merchant_sms' in v_add_reference)=0
     or position('reference_normalisee=v_reference' in replace(v_add_reference,' ',''))=0
     or position('L ID de transaction du SMS de credit ne correspond pas' in v_add_reference)=0
     or position('naxa_promoteur_payment_sms_evidence' in v_add_reference)=0 then
    raise exception 'Le SMS crédit n''est pas attaché à la preuve débit ayant le même ID';
  end if;

  select pg_get_constraintdef(oid)
  into v_status_check
  from pg_constraint
  where conrelid='public.abonnement_promoteur_reglements'::regclass
    and conname='abonnement_promoteur_reglements_verification_status_ck';
  if v_status_check is null or position('auto_confirmed_admin_sms' in v_status_check)=0 then
    raise exception 'Le statut de confirmation automatique Admin est absent';
  end if;

  select indexdef into v_unique
  from pg_indexes
  where schemaname='public' and indexname='naxa_admin_payment_capture_reference_unique';
  if v_unique is null or position('unique' in lower(v_unique))=0 then
    raise exception 'Les références des SMS Admin ne sont pas uniques';
  end if;
end
$test$;

rollback;
select 'Paiement Promoteur — deux SMS, même ID transaction : PASS' as resultat;
