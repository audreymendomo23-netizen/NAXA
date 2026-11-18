-- Test structurel Livechat NAXA. Aucun compte, ticket ou message n'est créé.
do $test$
declare
  v_def text;
begin
  if to_regprocedure('public.open_naxa_support_ticket(text,text,text)') is null then
    raise exception 'RPC atomique livechat absente';
  end if;
  if has_function_privilege('anon','public.open_naxa_support_ticket(text,text,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.open_naxa_support_ticket(text,text,text)','EXECUTE') then
    raise exception 'Privilèges RPC livechat incorrects';
  end if;

  select pg_get_functiondef('public.open_naxa_support_ticket(text,text,text)'::regprocedure) into v_def;
  if position('SECURITY INVOKER' in upper(v_def))=0
     or position('support_naxa' in v_def)=0
     or position('conseil_pharmacien' in v_def)>0 then
    raise exception 'RPC livechat ne respecte pas l’isolation Client/Admin/pharmacie';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.tickets_support'::regclass
      and tgname='trg_naxa_support_notify_new_ticket'
      and not tgisinternal
  ) then raise exception 'Notification Admin à la création absente'; end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.messages_support'::regclass
      and tgname='trg_naxa_support_notify_client_reply'
      and not tgisinternal
  ) then raise exception 'Notification Admin à chaque réponse Client absente'; end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.messages_support'::regclass
      and tgname='trg_naxa_support_clear_resolution_on_client_reply'
      and not tgisinternal
  ) then raise exception 'Nettoyage resolved_at au retour du Client absent'; end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='tickets_support'
  ) then raise exception 'tickets_support absent de Realtime'; end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='messages_support'
  ) then raise exception 'messages_support absent de Realtime'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='messages_support'
      and policyname='messages_support_acces' and cmd='SELECT'
      and position('interne = false' in qual)>0
  ) then raise exception 'La confidentialité des messages internes n’est pas préservée'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='tickets_support'
      and policyname='tickets_support_client_create_naxa_support' and cmd='INSERT'
      and position('naxa_business_function' in with_check)>0
  ) then raise exception 'Création ticket exigeant l’espace Client actif absente'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='messages_support'
      and policyname='messages_support_chat_participant_insert' and cmd='INSERT'
      and position('naxa_business_function' in with_check)>0
  ) then raise exception 'Insertion message exigeant l’espace Client actif absente'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='tickets_support'
      and policyname='tickets_support_acces' and cmd='SELECT'
      and position('actif IS TRUE' in qual)>0
      and position('naxa_business_function' in qual)>0
  ) then raise exception 'Lecture ticket réservée à l’Admin actif et au propriétaire Client actif'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='messages_support'
      and policyname='messages_support_acces' and cmd='SELECT'
      and position('actif IS TRUE' in qual)>0
      and position('interne = false' in qual)>0
      and position('naxa_business_function' in qual)>0
  ) then raise exception 'Lecture messages et notes internes insuffisamment cloisonnée'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='tickets_support'
      and policyname='tickets_support_acces' and cmd='SELECT'
      and position('actif IS TRUE' in qual)>0
  ) then raise exception 'Lecture tickets réservée à un Admin actif ou au propriétaire'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='messages_support'
      and policyname='messages_support_acces' and cmd='SELECT'
      and position('actif IS TRUE' in qual)>0
      and position('interne = false' in qual)>0
  ) then raise exception 'Lecture messages et notes internes insuffisamment cloisonnée'; end if;
end;
$test$;

select 'naxa_livechat_realtime_structure_pass' as test_name, true as passed;
