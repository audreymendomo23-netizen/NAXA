-- Contrôles structurels Assistance Client -> NAXA (aucun compte, ticket ou fichier créé).
do $test$
declare
  v_def text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tickets_support' and column_name='reference_code'
      and is_nullable='NO'
  ) then raise exception 'Référence ticket obligatoire absente'; end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='tickets_support' and column_name='categorie'
  ) then raise exception 'Catégorie de support absente'; end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname='public' and tablename='tickets_support'
      and indexname='tickets_support_reference_code_uq'
  ) then raise exception 'Index unique de référence absent'; end if;

  if not (select relrowsecurity from pg_class where oid='public.tickets_support'::regclass)
     or not (select relrowsecurity from pg_class where oid='public.messages_support'::regclass)
     or not (select relrowsecurity from pg_class where oid='storage.objects'::regclass) then
    raise exception 'RLS absent sur une table sensible';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='tickets_support'
      and policyname='tickets_support_client_create_naxa_support' and cmd='INSERT'
  ) then raise exception 'Politique de création Client NAXA absente'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='messages_support'
      and policyname='messages_support_chat_participant_insert' and cmd='INSERT'
  ) then raise exception 'Politique d’envoi Client NAXA absente'; end if;

  if not exists (
    select 1 from storage.buckets
    where id='naxa-support-attachments' and public=false
      and file_size_limit=4194304
      and allowed_mime_types @> array['application/pdf','image/jpeg','image/png','image/webp']
  ) then raise exception 'Bucket privé ou restrictions pièce jointe incorrects'; end if;

  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects'
    and policyname='naxa_support_attachment_insert_own' and cmd='INSERT') then
    raise exception 'Politique Storage upload absente'; end if;

  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects'
    and policyname='naxa_support_attachment_read_own' and cmd='SELECT') then
    raise exception 'Politique Storage lecture propriétaire absente'; end if;

  select pg_get_functiondef('public.support_chat_mark_first_response()'::regprocedure) into v_def;
  if position('support_naxa' in v_def)=0 or position('en_attente_client' in v_def)=0 then
    raise exception 'Cycle de statut du ticket NAXA absent du trigger'; end if;

  if has_function_privilege('anon','public.support_chat_mark_first_response()','EXECUTE')
     or has_function_privilege('authenticated','public.support_chat_mark_first_response()','EXECUTE') then
    raise exception 'Fonction trigger exécutable directement par un rôle API';
  end if;
end;
$test$;

select 'naxa_client_support_workspace_structure_pass' as test_name, true as passed;
