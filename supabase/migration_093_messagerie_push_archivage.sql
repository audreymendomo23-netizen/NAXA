-- NAXA 093 — conversations persistantes, archivage client et Push de messagerie.
-- Migration additive : les conversations et messages existants sont conservés.
begin;
alter table public.fils_messages add column if not exists client_archived_at timestamptz;
create index if not exists fils_messages_client_inbox_idx on public.fils_messages(client_id, client_archived_at, created_at desc);
create or replace function public.definir_anonymat_fil(p_fil uuid, p_anonyme boolean)
returns boolean language plpgsql security definer set search_path = ''
as $function$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  update public.fils_messages set anonyme = coalesce(p_anonyme, true) where id = p_fil and client_id = v_user;
  if not found then raise exception 'Conversation introuvable ou accès refusé'; end if;
  return true;
end;
$function$;
create or replace function public.archiver_conversation_client(p_fil uuid, p_archiver boolean default true)
returns boolean language plpgsql security definer set search_path = ''
as $function$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  update public.fils_messages set client_archived_at = case when coalesce(p_archiver, true) then now() else null end where id = p_fil and client_id = v_user;
  if not found then raise exception 'Conversation introuvable ou accès refusé'; end if;
  return true;
end;
$function$;
revoke all on function public.definir_anonymat_fil(uuid,boolean) from public, anon;
revoke all on function public.archiver_conversation_client(uuid,boolean) from public, anon;
grant execute on function public.definir_anonymat_fil(uuid,boolean) to authenticated;
grant execute on function public.archiver_conversation_client(uuid,boolean) to authenticated;
commit;
