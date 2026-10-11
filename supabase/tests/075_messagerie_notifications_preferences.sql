-- Test structurel NAXA 075 ; rollback systématique.
begin;
do $test$
declare t text; fn regprocedure;
begin
  if not (select relrowsecurity from pg_class where oid='public.client_preferences'::regclass) then raise exception 'RLS absente client_preferences'; end if;
  if not (select relrowsecurity from pg_class where oid='public.fils_messages'::regclass) then raise exception 'RLS absente fils_messages'; end if;
  if not (select relrowsecurity from pg_class where oid='public.messages_pharmacie'::regclass) then raise exception 'RLS absente messages_pharmacie'; end if;
  if not (select relrowsecurity from pg_class where oid='public.notifications'::regclass) then raise exception 'RLS absente notifications'; end if;
  foreach t in array array['envoyer_message_client(uuid,uuid,text,boolean)','repondre_message(uuid,text)','marquer_fil_lu(uuid)','boite_pharmacie(uuid)'] loop
    fn := to_regprocedure('public.'||t);
    if fn is null then raise exception 'Fonction absente: %',t; end if;
    if has_function_privilege('anon',fn,'EXECUTE') then raise exception 'Fonction exécutable par anon: %',t; end if;
  end loop;
  if has_table_privilege('authenticated','public.fils_messages','INSERT') or has_table_privilege('authenticated','public.fils_messages','UPDATE') or has_table_privilege('authenticated','public.fils_messages','DELETE') then raise exception 'Écriture directe autorisée sur fils_messages'; end if;
  if has_table_privilege('authenticated','public.messages_pharmacie','INSERT') or has_table_privilege('authenticated','public.messages_pharmacie','UPDATE') or has_table_privilege('authenticated','public.messages_pharmacie','DELETE') then raise exception 'Écriture directe autorisée sur messages_pharmacie'; end if;
end;
$test$;
select true as naxa_075_messagerie_security_pass;
rollback;
