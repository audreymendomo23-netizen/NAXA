do $$
declare
  v_matcher text;
  v_trigger text;
  v_declare text;
  v_intent_function regprocedure := 'public.naxa_delivery_get_or_create_payment_intent(uuid,uuid,text)'::regprocedure;
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='naxa_delivery_payment_intents' and c.relrowsecurity
  ) then
    raise exception 'RLS absent sur les intentions de paiement livraison';
  end if;

  if has_table_privilege('authenticated','public.naxa_delivery_payment_intents','select')
     or has_table_privilege('anon','public.naxa_delivery_payment_intents','select') then
    raise exception 'Une lecture directe publique des intentions est possible';
  end if;

  if not has_function_privilege('service_role',v_intent_function,'execute')
     or has_function_privilege('authenticated',v_intent_function,'execute')
     or has_function_privilege('anon',v_intent_function,'execute') then
    raise exception 'ACL RPC de création d''intention incorrecte';
  end if;

  select pg_get_functiondef('public.naxa_match_delivery_payment_sms(uuid,text)'::regprocedure) into v_matcher;
  select pg_get_functiondef('private.naxa_match_delivery_sms_on_arrival()'::regprocedure) into v_trigger;
  select pg_get_functiondef('public.naxa_client_declarer_paiement_livraison_v2(uuid,uuid,text,text,integer,timestamptz,text,jsonb,text)'::regprocedure) into v_declare;

  if position('payment_intent_missing_manual_review' in v_matcher)=0
     or position('destination_snapshot' in v_matcher)=0 then
    raise exception 'Le moteur ne vérifie pas l''instantané figé';
  end if;

  if position('status=''submitted''' in v_trigger)=0 then
    raise exception 'Le déclencheur ne soumet pas l''intention avant le rapprochement';
  end if;

  if position('payment_intent_id' in v_declare)=0 then
    raise exception 'La déclaration Client ne rattache pas l''intention';
  end if;
end;
$$;
