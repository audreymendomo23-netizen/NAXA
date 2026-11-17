-- Contrat structurel de l'outbox e-mail universelle. Aucun e-mail n'est envoyé.
begin;

do $$
begin
  if to_regclass('private.email_delivery_outbox') is null then
    raise exception '263 FAIL: outbox universelle absente';
  end if;

  if not (select relrowsecurity from pg_class
          where oid = 'private.email_delivery_outbox'::regclass) then
    raise exception '263 FAIL: RLS absente';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'private.email_delivery_outbox'::regclass
      and conname = 'email_delivery_outbox_event_key_key'
  ) then
    raise exception '263 FAIL: idempotence event_key absente';
  end if;

  if not has_function_privilege('service_role',
       'public.enqueue_naxa_email_event(text,text,text,text,text,text,uuid,jsonb)','EXECUTE')
     or not has_function_privilege('service_role',
       'public.claim_naxa_email_events(integer)','EXECUTE')
     or not has_function_privilege('service_role',
       'public.finish_naxa_email_event(uuid,boolean,text,text)','EXECUTE') then
    raise exception '263 FAIL: droits service_role incomplets';
  end if;

  if has_function_privilege('anon',
       'public.enqueue_naxa_email_event(text,text,text,text,text,text,uuid,jsonb)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.enqueue_naxa_email_event(text,text,text,text,text,text,uuid,jsonb)','EXECUTE')
     or has_function_privilege('anon',
       'public.claim_naxa_email_events(integer)','EXECUTE')
     or has_function_privilege('authenticated',
       'public.claim_naxa_email_events(integer)','EXECUTE') then
    raise exception '263 FAIL: fonction accessible à un rôle client';
  end if;
end;
$$;

rollback;
select '263 universal email outbox contract PASS' as resultat;
