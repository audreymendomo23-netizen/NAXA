-- Test transactionnel du cycle complet outbox sans appel externe à Google.
begin;

insert into auth.users(instance_id,id,aud,role,email,raw_user_meta_data,created_at,updated_at)
values (
  '00000000-0000-0000-0000-000000000000',
  '01600000-0000-4000-8000-000000000001',
  'authenticated','authenticated',
  'naxa-outbox-test@example.invalid',
  '{"naxa_signup_pending":true}'::jsonb,
  now(),now()
);

insert into public.notifications(id,user_id,type,titre,corps)
values (
  '01600000-0000-4000-8000-000000000101',
  '01600000-0000-4000-8000-000000000001',
  'abonnement_reglement_soumis',
  'E16 test outbox',
  'Message de test sans envoi externe'
);

do $test$
declare
  v record;
  v_finished boolean;
  v_status text;
begin
  if not exists (
    select 1 from private.notification_email_outbox
    where notification_id='01600000-0000-4000-8000-000000000101'
      and status='pending'
  ) then
    raise exception 'E16 FAIL: trigger did not enqueue';
  end if;

  select * into v
  from public.claim_notification_email_outbox(10)
  where notification_id='01600000-0000-4000-8000-000000000101';

  if v.outbox_id is null
     or v.email <> 'naxa-outbox-test@example.invalid'
     or v.title <> 'E16 test outbox'
     or v.attempt_count <> 1 then
    raise exception 'E16 FAIL: claim contract: %',row_to_json(v);
  end if;

  v_finished := public.finish_notification_email_outbox(
    v.outbox_id,true,'provider-test-id',null
  );
  if v_finished is distinct from true then
    raise exception 'E16 FAIL: finish did not update claimed row';
  end if;

  select status into v_status
  from private.notification_email_outbox
  where id=v.outbox_id;

  if v_status <> 'sent' then
    raise exception 'E16 FAIL: final status %, expected sent',v_status;
  end if;
end;
$test$;

select 'E16 email outbox enqueue/claim/finish PASS (no external send)' as resultat;
rollback;
