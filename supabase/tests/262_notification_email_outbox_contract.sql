-- Test structurel du contrat outbox e-mail. Ne déclenche aucun envoi externe.
begin;

do $$
begin
  if to_regclass('private.notification_email_outbox') is null then
    raise exception '262 FAIL: outbox privée absente';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_enqueue_notification_email'
      and tgrelid = 'public.notifications'::regclass
      and not tgisinternal
  ) then
    raise exception '262 FAIL: trigger de mise en file absent';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'private.notification_email_outbox'::regclass
      and conname = 'notification_email_outbox_notification_channel_uq'
  ) then
    raise exception '262 FAIL: contrainte anti-doublon absente';
  end if;

  if not (
    select relrowsecurity
    from pg_class
    where oid = 'private.notification_email_outbox'::regclass
  ) then
    raise exception '262 FAIL: RLS non activée sur la file privée';
  end if;

  if not has_function_privilege('service_role', 'public.claim_notification_email_outbox(integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.finish_notification_email_outbox(uuid,boolean,text,text)', 'EXECUTE') then
    raise exception '262 FAIL: droits service_role incomplets';
  end if;

  if has_function_privilege('anon', 'public.claim_notification_email_outbox(integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.claim_notification_email_outbox(integer)', 'EXECUTE')
     or has_function_privilege('anon', 'public.finish_notification_email_outbox(uuid,boolean,text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.finish_notification_email_outbox(uuid,boolean,text,text)', 'EXECUTE') then
    raise exception '262 FAIL: fonction accessible à un rôle public';
  end if;
end;
$$;

rollback;
select '262 notification email outbox structure/ACL PASS' as resultat;
