do $$
declare
  v_intent text;
  v_matcher text;
  v_cancel text;
  v_transition text;
begin
  if not exists(
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='naxa_universe_payment_intents' and c.relrowsecurity
  ) or not exists(
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='naxa_universe_payment_confirmations' and c.relrowsecurity
  ) then
    raise exception 'RLS absent sur les tables de paiement Partenaire';
  end if;

  if has_table_privilege('authenticated','public.naxa_universe_payment_intents','select')
     or has_table_privilege('anon','public.naxa_universe_payment_intents','select')
     or has_table_privilege('authenticated','public.naxa_universe_payment_confirmations','select')
     or has_table_privilege('anon','public.naxa_universe_payment_confirmations','select') then
    raise exception 'Accès direct utilisateur aux registres techniques Partenaire';
  end if;

  if not has_function_privilege('service_role','public.naxa_universe_get_or_create_payment_intent(uuid,uuid,text)','execute')
     or has_function_privilege('authenticated','public.naxa_universe_get_or_create_payment_intent(uuid,uuid,text)','execute')
     or not has_function_privilege('service_role','public.naxa_universe_declare_payment(uuid,uuid,text,text,text,integer,timestamptz,text,jsonb,text)','execute')
     or has_function_privilege('authenticated','public.naxa_universe_declare_payment(uuid,uuid,text,text,text,integer,timestamptz,text,jsonb,text)','execute')
     or not has_function_privilege('service_role','public.naxa_match_universe_payment_sms(uuid,text)','execute')
     or has_function_privilege('authenticated','public.naxa_match_universe_payment_sms(uuid,text)','execute')
     or not has_function_privilege('service_role','public.naxa_universe_cancel_payment_intent(uuid,uuid)','execute')
     or has_function_privilege('authenticated','public.naxa_universe_cancel_payment_intent(uuid,uuid)','execute') then
    raise exception 'ACL des RPC de paiement Partenaire incorrectes';
  end if;

  select pg_get_functiondef('public.naxa_universe_get_or_create_payment_intent(uuid,uuid,text)'::regprocedure) into v_intent;
  if position('merchant_code' in v_intent)=0 or position('^[0-9]{6}$' in v_intent)=0
     or position('destination_snapshot' in v_intent)=0 then
    raise exception 'Le bénéficiaire ou code marchand n''est pas figé/validé';
  end if;

  select pg_get_functiondef('public.naxa_match_universe_payment_sms(uuid,text)'::regprocedure) into v_matcher;
  if position('transaction_reference_already_confirmed' in v_matcher)=0
     or position('coherent_confirmed' in v_matcher)=0
     or position('NAXA-PAR-' in v_matcher)=0
     or position('merchant_credit' in v_matcher)=0 then
    raise exception 'Le matcher Partenaire ne confirme pas la paire ou ne protège pas contre la réutilisation';
  end if;

  select pg_get_functiondef('public.naxa_universe_cancel_payment_intent(uuid,uuid)'::regprocedure) into v_cancel;
  if position('v_intent.status<>''active''' in v_cancel)=0
     or position('v_res.payment_status<>''awaiting_payment''' in v_cancel)=0 then
    raise exception 'Annulation possible après soumission du SMS payeur';
  end if;

  select pg_get_functiondef('public.transition_universe_reservation(uuid,text)'::regprocedure) into v_transition;
  if position('p_status=''ready'' and r.status in (''requested'',''confirmed'')' in v_transition)=0 then
    raise exception 'Transition historique requested/confirmed vers ready perdue';
  end if;
  if position('payment_mode in (''orange_money'',''mtn_momo'') and r.payment_status<>''confirmed''' in v_transition)=0 then
    raise exception 'Le retrait n''est pas protégé par les deux SMS';
  end if;

  if not exists(
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
    where c.relname='naxa_universe_payment_intents'
      and t.tgname='trg_naxa_universe_payment_match_after_submission'
      and not t.tgisinternal
  ) or not exists(
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid
    where c.relname='naxa_payment_evidence_intake'
      and t.tgname='trg_naxa_partner_sms_match_after_credit'
      and not t.tgisinternal
  ) then
    raise exception 'Déclencheurs de rapprochement SMS Partenaire incomplets';
  end if;
end;
$$;
