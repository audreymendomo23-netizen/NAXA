-- Test structurel NAXA 077 ; rollback systématique.
begin;
do $test$
declare
  fn regprocedure;
  v_def boolean;
  v_config text[];
  v_source text;
begin
  fn := to_regprocedure('public.naxa_complete_google_profile(text,text,text,text,text,date,boolean)');
  if fn is null then raise exception 'RPC onboarding Google absente'; end if;
  select prosecdef, proconfig into v_def, v_config from pg_proc where oid = fn;
  if not coalesce(v_def,false) then raise exception 'RPC onboarding sans SECURITY DEFINER'; end if;
  if not coalesce(v_config @> array['search_path=""']::text[],false) then
    raise exception 'search_path RPC onboarding non vide ou non fixé: %',v_config;
  end if;
  if has_function_privilege('anon',fn,'EXECUTE') then raise exception 'RPC onboarding exécutable par anon'; end if;
  if not has_function_privilege('authenticated',fn,'EXECUTE') then raise exception 'RPC onboarding non exécutable par authenticated'; end if;
  select pg_get_functiondef('public.handle_new_user()'::regprocedure) into v_source;
  if position('raw_app_meta_data' in v_source)=0 or position('google' in lower(v_source))=0 then
    raise exception 'Déclencheur ne distingue pas Google OAuth';
  end if;
  if position('NAXA est réservé aux personnes âgées de 18 ans ou plus' in v_source)=0
     or position('consent_accepted' in v_source)=0 then
    raise exception 'Contrôles âge/consentement absents du déclencheur';
  end if;
end;
$test$;
select true as naxa_077_google_onboarding_security_pass;
rollback;
