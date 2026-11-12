-- Recette SQL runtime du cycle de vie des rappels de rendez-vous Prestations.
-- Le test est transactionnel et doit être exécuté sur Replay ou une base de test.
-- Le ROLLBACK final retire intégralement les identités et données synthétiques.
begin;

do $test$
declare
  v_owner uuid := gen_random_uuid();
  v_client uuid := gen_random_uuid();
  v_partner uuid := gen_random_uuid();
  v_offer uuid := gen_random_uuid();
  v_request uuid := gen_random_uuid();
  v_outbox uuid := gen_random_uuid();
  v_username text := 'naxatest' || left(replace(gen_random_uuid()::text,'-',''),12);
  v_email_owner text;
  v_email_client text;
  v_schedule_one timestamptz := now()+interval '2 days';
  v_schedule_two timestamptz := now()+interval '1 day';
  v_count integer;
  v_state text;
begin
  v_email_owner := 'home-reminder-owner-' || replace(v_owner::text,'-','') || '@example.invalid';
  v_email_client := 'home-reminder-client-' || replace(v_client::text,'-','') || '@example.invalid';

  insert into auth.users(
    id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous
  ) values (
    v_owner,'authenticated','authenticated',v_email_owner,null,now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'username',v_username,
      'first_name','Test',
      'last_name','Prestataire',
      'phone','+237681972237',
      'phone_country','CM',
      'date_of_birth','1990-01-01',
      'consent_accepted',true
    ),
    now(),now(),false,false
  );

  insert into auth.users(
    id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous
  ) values (
    v_client,'authenticated','authenticated',v_email_client,null,now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"naxa_signup_pending":"true"}'::jsonb,
    now(),now(),false,false
  );

  if not exists (select 1 from public.profiles where id=v_owner and actif=true) then
    raise exception 'Owner profile was not created as active by the Auth trigger';
  end if;

  insert into public.partners(id,name,partner_type,city,status,created_by,verified_at,verified_by)
  values(v_partner,'NAXA Temporary Reminder Test','professionnel_domicile','Yaoundé','active',v_owner,now(),v_owner);

  insert into public.partner_universes(partner_id,universe_slug,enabled)
  values(v_partner,'prestations',true);

  insert into public.partner_members(partner_id,user_id,member_role)
  values(v_partner,v_owner,'owner');

  insert into public.home_service_offers(
    id,partner_id,name,category,service_area_label,price_fcfa,status,created_by
  ) values(v_offer,v_partner,'Test rendez-vous','Soins','Yaoundé',1000,'active',v_owner);

  insert into public.home_service_requests(
    id,client_id,partner_id,offer_id,offer_name,category,price_fcfa,
    service_area_label,preferred_at,client_note,status
  ) values (
    v_request,v_client,v_partner,v_offer,'Test rendez-vous','Soins',1000,
    'Yaoundé',v_schedule_one,'Test temporaire cycle rappels','requested'
  );

  insert into public.home_service_reminder_preferences(
    partner_id,user_id,enabled,offsets_minutes,timezone
  ) values(v_partner,v_owner,true,array[1440,120,30]::integer[],'Africa/Douala');

  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  perform public.confirm_home_service_appointment(v_request,v_schedule_one);

  select count(*) into v_count
  from public.home_service_reminder_dispatches
  where request_id=v_request and recipient_id=v_owner and state='pending';
  if v_count<>3 then raise exception 'Confirmation expected 3 pending reminders; got %',v_count; end if;

  update public.home_service_reminder_preferences
  set offsets_minutes=array[60,30]::integer[],updated_at=now()
  where partner_id=v_partner and user_id=v_owner;

  select count(*) into v_count
  from public.home_service_reminder_dispatches
  where request_id=v_request and recipient_id=v_owner
    and offset_minutes in (1440,120) and state='cancelled';
  if v_count<>2 then raise exception 'Removed offsets must be cancelled; got %/2',v_count; end if;

  select count(*) into v_count
  from public.home_service_reminder_dispatches
  where request_id=v_request and recipient_id=v_owner
    and offset_minutes in (60,30) and state='pending';
  if v_count<>2 then raise exception 'Updated offsets must be pending; got %/2',v_count; end if;

  update public.home_service_reminder_preferences
  set enabled=false,updated_at=now()
  where partner_id=v_partner and user_id=v_owner;

  select count(*) into v_count
  from public.home_service_reminder_dispatches
  where request_id=v_request and recipient_id=v_owner and state in ('pending','processing');
  if v_count<>0 then raise exception 'Disabling reminders must cancel all pending dispatches; got %',v_count; end if;

  update public.home_service_reminder_preferences
  set enabled=true,updated_at=now()
  where partner_id=v_partner and user_id=v_owner;

  select count(*) into v_count
  from public.home_service_reminder_dispatches
  where request_id=v_request and recipient_id=v_owner
    and offset_minutes in (60,30) and state='pending';
  if v_count<>2 then raise exception 'Re-enabling reminders must recreate pending offsets; got %/2',v_count; end if;

  update public.profiles set actif=false where id=v_owner;
  select count(*) into v_count
  from public.home_service_reminder_dispatches
  where request_id=v_request and recipient_id=v_owner and state in ('pending','processing');
  if v_count<>0 then raise exception 'Inactive profile must cancel pending dispatches; got %',v_count; end if;

  update public.profiles set actif=true where id=v_owner;
  select count(*) into v_count
  from public.home_service_reminder_dispatches
  where request_id=v_request and recipient_id=v_owner
    and offset_minutes in (60,30) and state='pending';
  if v_count<>2 then raise exception 'Reactivated profile must restore valid dispatches; got %/2',v_count; end if;

  update public.partners set status='suspended' where id=v_partner;
  select count(*) into v_count
  from public.home_service_reminder_dispatches
  where request_id=v_request and recipient_id=v_owner and state in ('pending','processing');
  if v_count<>0 then raise exception 'Suspended partner must cancel pending dispatches; got %',v_count; end if;

  update public.partners set status='active' where id=v_partner;
  select count(*) into v_count
  from public.home_service_reminder_dispatches
  where request_id=v_request and recipient_id=v_owner
    and offset_minutes in (60,30) and state='pending';
  if v_count<>2 then raise exception 'Reactivated partner must restore valid dispatches; got %/2',v_count; end if;

  delete from public.partner_members where partner_id=v_partner and user_id=v_owner;
  select count(*) into v_count
  from public.home_service_reminder_dispatches
  where request_id=v_request and recipient_id=v_owner and state in ('pending','processing');
  if v_count<>0 then raise exception 'Removed member must cancel pending dispatches; got %',v_count; end if;

  insert into public.partner_members(partner_id,user_id,member_role)
  values(v_partner,v_owner,'owner');
  select count(*) into v_count
  from public.home_service_reminder_dispatches
  where request_id=v_request and recipient_id=v_owner
    and offset_minutes in (60,30) and state='pending';
  if v_count<>2 then raise exception 'Reassigned member must restore valid dispatches; got %/2',v_count; end if;

  update public.home_service_requests
  set scheduled_at=v_schedule_two,updated_at=now()
  where id=v_request and status='confirmed';

  select count(*) into v_count
  from public.home_service_reminder_dispatches
  where request_id=v_request and recipient_id=v_owner
    and offset_minutes in (60,30) and state='pending'
    and scheduled_at=v_schedule_two and attempts=0 and notification_created_at is null;
  if v_count<>2 then raise exception 'Reschedule must reset 2 active dispatches; got %/2',v_count; end if;

  select count(*) into v_count
  from public.home_service_reminder_dispatches
  where request_id=v_request and recipient_id=v_owner
    and offset_minutes in (1440,120) and state='cancelled';
  if v_count<>2 then raise exception 'Reschedule must preserve removed offsets as cancelled; got %/2',v_count; end if;

  update public.home_service_reminder_dispatches
  set state='processing',attempts=12,locked_at=now()-interval '11 minutes'
  where request_id=v_request and recipient_id=v_owner and offset_minutes=30;
  perform * from public.claim_home_service_reminder_dispatches(20);

  select state into v_state
  from public.home_service_reminder_dispatches
  where request_id=v_request and recipient_id=v_owner and offset_minutes=30;
  if v_state<>'failed' then raise exception 'Home-service max attempts must be terminal failed; got %',v_state; end if;

  insert into public.naxa_notification_push_outbox(
    id,source_notification_id,recipient_id,notification_type,title,body,state,attempts
  ) values (
    v_outbox,'lifecycle-test-'||v_outbox::text,v_owner,
    'home_service_test','Test de contrat','Contenu de test','pending',12
  );
  perform * from public.claim_naxa_notification_push_outbox(20);

  select state into v_state
  from public.naxa_notification_push_outbox where id=v_outbox;
  if v_state<>'failed' then raise exception 'Global Push max attempts must be terminal failed; got %',v_state; end if;

  update public.home_service_requests set status='cancelled',updated_at=now() where id=v_request;
  select count(*) into v_count
  from public.home_service_reminder_dispatches
  where request_id=v_request and state in ('pending','processing');
  if v_count<>0 then raise exception 'Cancelled appointment must have no pending dispatches; got %',v_count; end if;
end
$test$;

select 'naxa_home_service_reminder_runtime_lifecycle_pass' as test,true as passed;
rollback;
