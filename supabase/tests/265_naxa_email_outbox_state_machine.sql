-- Contrat transactionnel de l'outbox e-mail NAXA : idempotence, claim, retry et succès.
begin;
do $state$
declare
  v_first uuid;
  v_second uuid;
  v_claim uuid;
  v_status text;
begin
  v_first:=public.enqueue_naxa_email_event(
    'test-email-outbox-state-machine','system.test','system',
    'outbox-test@example.invalid','Test NAXA','Message de test transactionnel',null,'{}'::jsonb
  );
  v_second:=public.enqueue_naxa_email_event(
    'test-email-outbox-state-machine','system.test','system',
    'outbox-test@example.invalid','Test NAXA','Message de test transactionnel',null,'{}'::jsonb
  );
  if v_first is null or v_first<>v_second then
    raise exception '265 FAIL: enqueue non idempotent';
  end if;

  select outbox_id into v_claim
  from public.claim_naxa_email_events(5)
  where event_key='test-email-outbox-state-machine';
  if v_claim is distinct from v_first then
    raise exception '265 FAIL: claim ne retourne pas le message attendu';
  end if;

  if not public.finish_naxa_email_event(v_claim,false,null,'échec simulé') then
    raise exception '265 FAIL: accusé d''échec non enregistré';
  end if;
  select status into v_status from private.email_delivery_outbox where id=v_first;
  if v_status<>'pending' then
    raise exception '265 FAIL: le message échoué ne revient pas en pending';
  end if;

  update private.email_delivery_outbox
  set next_attempt_at=now()
  where id=v_first;
  select outbox_id into v_claim
  from public.claim_naxa_email_events(5)
  where event_key='test-email-outbox-state-machine';
  if v_claim is distinct from v_first then
    raise exception '265 FAIL: reprise du message impossible';
  end if;
  if not public.finish_naxa_email_event(v_claim,true,null,null) then
    raise exception '265 FAIL: accusé de succès non enregistré';
  end if;
  select status into v_status from private.email_delivery_outbox where id=v_first;
  if v_status<>'sent' then
    raise exception '265 FAIL: le message final n''est pas sent';
  end if;
end $state$;
select '265 email outbox state machine PASS' as resultat;
rollback;
