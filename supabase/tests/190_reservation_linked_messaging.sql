-- NAXA 190 — tests structurels messagerie transactionnelle.
begin;
do $test$
begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='messages_pharmacie' and column_name='reservation_id') then
  raise exception 'Lien message-réservation absent';
 end if;
 if to_regprocedure('public.envoyer_message_reservation(uuid,text,boolean)') is null then
  raise exception 'RPC de messagerie transactionnelle absente';
 end if;
 if has_function_privilege('anon','public.envoyer_message_reservation(uuid,text,boolean)','EXECUTE') then
  raise exception 'RPC accessible à anon';
 end if;
end;
$test$;
rollback;
