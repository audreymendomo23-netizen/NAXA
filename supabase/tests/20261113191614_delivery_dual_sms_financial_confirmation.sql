do $$
declare
  v_matcher text;
begin
  if not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='naxa_delivery_payment_confirmations' and c.relrowsecurity
  ) then raise exception 'RLS absent sur les reçus de confirmation'; end if;

  if has_table_privilege('authenticated','public.naxa_delivery_payment_confirmations','select')
     or has_table_privilege('anon','public.naxa_delivery_payment_confirmations','select') then
    raise exception 'Lecture publique des reçus possible';
  end if;

  if not has_table_privilege('service_role','public.naxa_delivery_payment_confirmations','select') then
    raise exception 'Le service interne ne peut pas lire les reçus';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.naxa_delivery_payment_confirmations'::regclass
      and conname='naxa_delivery_payment_confirmations_payment_record_id_key'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid='public.naxa_delivery_payment_confirmations'::regclass
      and conname='naxa_delivery_payment_confirmations_merchant_evidence_id_key'
  ) or not exists (
    select 1 from pg_constraint
    where conrelid='public.naxa_delivery_payment_confirmations'::regclass
      and conname='naxa_delivery_payment_confirmations_reservation_id_key'
  ) then
    raise exception 'Les gardes anti-double-reçu sont incomplètes';
  end if;

  select pg_get_functiondef('public.naxa_match_delivery_payment_sms(uuid,text)'::regprocedure)
  into v_matcher;
  if position('financially_confirmed_waiting_pos' in v_matcher)=0
     or position('receipt_number' in v_matcher)=0
     or position('payer_sms_sha256' in v_matcher)=0
     or position('merchant_sms_sha256' in v_matcher)=0
     or position('coherent_confirmed' in v_matcher)=0 then
    raise exception 'Le matcher n''émet pas le reçu sur preuve double';
  end if;

  if position('naxa_delivery_pos_encaisser' in v_matcher)>0
     or position('update public.reservations' in v_matcher)>0 then
    raise exception 'La confirmation financière déclenche une écriture POS prématurée';
  end if;

  if not has_function_privilege('service_role','public.naxa_match_delivery_payment_sms(uuid,text)','execute')
     or has_function_privilege('authenticated','public.naxa_match_delivery_payment_sms(uuid,text)','execute')
     or has_function_privilege('anon','public.naxa_match_delivery_payment_sms(uuid,text)','execute') then
    raise exception 'ACL du moteur de confirmation incorrecte';
  end if;
end;
$$;
