-- NAXA — la suppression Auth en cascade ne doit pas échouer sur l'audit des sessions.
-- Le test utilise uniquement l'identité Admin E2E dédiée de Replay et annule toutes les écritures.
begin;

do $test$
declare
  v_user uuid;
  v_session uuid := 'a2b0b4b1-9e0a-4d73-9f91-1d64e1a1c002';
  v_state text;
  v_message text;
begin
  select u.id into v_user
  from auth.users u
  where u.email = 'naxa.e2e.20261104.admin@example.invalid';

  if v_user is null then
    raise exception 'Fixture Admin E2E dédiée absente';
  end if;

  if exists (select 1 from auth.sessions where id=v_session)
     or exists (select 1 from public.naxa_session_audit where session_id=v_session) then
    raise exception 'Collision de fixture : session ou audit déjà présent';
  end if;

  insert into auth.sessions(id,user_id,created_at)
  values(v_session,v_user,now());

  -- La suppression du parent et sa cascade sont isolées dans un sous-bloc.
  -- L'exception sentinelle force le rollback local après un DELETE réussi.
  begin
    delete from auth.users where id=v_user;
    if not found then
      raise exception 'Le compte de test n''a pas été trouvé pour la suppression';
    end if;
    raise exception '__NAXA_EXPECTED_CASCADE_DELETE_ROLLBACK__';
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    if v_message <> '__NAXA_EXPECTED_CASCADE_DELETE_ROLLBACK__' then
      raise exception 'Suppression Auth en cascade bloquée : SQLSTATE %, %', v_state, v_message;
    end if;
  end;

  if not exists(select 1 from auth.users where id=v_user)
     or not exists(select 1 from auth.sessions where id=v_session and user_id=v_user) then
    raise exception 'Le sous-test en cascade n''a pas été intégralement annulé';
  end if;

  -- Une révocation ordinaire doit continuer à produire son événement d'audit.
  delete from auth.sessions where id=v_session;

  if not exists (
    select 1 from public.naxa_session_audit
    where session_id=v_session
      and user_id=v_user
      and event_type='SESSION_REVOKED'
  ) then
    raise exception 'La révocation ordinaire ne produit plus SESSION_REVOKED';
  end if;

  raise notice '314_session_audit_user_cascade PASS — cascade sans erreur + logout audité';
end
$test$;

rollback;
