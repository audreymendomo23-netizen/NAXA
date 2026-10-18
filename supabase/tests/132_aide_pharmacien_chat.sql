-- Test 132 — contrôles structurels du chat gratuit client-pharmacie.
do $test$
declare
  v_policy text;
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='open_pharmacist_chat'
      and pg_get_function_identity_arguments(p.oid)='p_pharmacy_id uuid, p_message text'
      and not p.prosecdef
  ) then raise exception 'RPC absent ou privilèges SECURITY DEFINER inattendus'; end if;

  if has_function_privilege('anon', 'public.open_pharmacist_chat(uuid,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'public.open_pharmacist_chat(uuid,text)', 'EXECUTE') then
    raise exception 'Privilèges RPC incorrects';
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='tickets_support'
    and policyname='tickets_support_client_create_pharmacist_chat' and cmd='INSERT') then
    raise exception 'Politique de création du ticket absente';
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='messages_support'
    and policyname='messages_support_chat_participant_insert' and cmd='INSERT') then
    raise exception 'Politique d’envoi des messages absente';
  end if;

  select qual into v_policy from pg_policies
  where schemaname='public' and tablename='messages_support'
    and policyname='messages_support_acces' and cmd='SELECT';
  if v_policy is null or position('interne = false' in v_policy)=0 then
    raise exception 'La lecture des messages ne filtre pas les notes internes';
  end if;

  if not (select relrowsecurity from pg_class where oid='public.tickets_support'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.messages_support'::regclass) then
    raise exception 'RLS doit rester activé sur les tickets et les messages';
  end if;
end;
$test$;

select
  'naxa_132_aide_pharmacien_chat_pass' as test_name,
  true as passed;
