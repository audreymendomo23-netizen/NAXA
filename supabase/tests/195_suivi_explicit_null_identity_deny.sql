-- NAXA 195 — un contexte sans identité doit toujours être refusé explicitement.
do $test$
declare
  v_def text := pg_get_functiondef('public.suivi_is_enabled_user(uuid)'::regprocedure);
  v_result boolean;
begin
  if position('coalesce' in lower(v_def)) = 0 then
    raise exception 'NAXA 195: le contrôle d’accès doit normaliser les refus en FALSE';
  end if;
  select public.suivi_is_enabled_user(null) into v_result;
  if v_result is distinct from false then
    raise exception 'NAXA 195: une identité NULL doit être explicitement refusée, reçu %', v_result;
  end if;
end;
$test$;
select true as naxa_195_null_identity_denied;
