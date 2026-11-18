-- Recette RLS Replay : chaque professionnel ouvre et lit son dossier, jamais celui d'un collègue.
begin;
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',(select id::text from public.profiles where username='naxa_e2e_livreur'))::text,true);
set local role authenticated;
select ticket_id from public.open_naxa_support_ticket('livraison','RLS Livreur support E2E','Message individuel Livreur.');
do $test$ declare n integer; begin
  select count(*) into n from public.tickets_support where sujet='RLS Livreur support E2E' and type='support_naxa';
  if n<>1 then raise exception 'Le Livreur ne lit pas son ticket'; end if;
  select count(*) into n from public.messages_support m join public.tickets_support t on t.id=m.ticket_id
    where t.sujet='RLS Livreur support E2E' and m.interne=false;
  if n<>1 then raise exception 'Le Livreur ne lit pas son message'; end if;
end $test$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',(select id::text from public.profiles where username='naxa_e2e_promoteur'))::text,true);
set local role authenticated;
do $test$ declare n integer; begin
  select count(*) into n from public.tickets_support where sujet='RLS Livreur support E2E';
  if n<>0 then raise exception 'Fuite du dossier Livreur vers le Promoteur'; end if;
end $test$;
select ticket_id from public.open_naxa_support_ticket('gestion_espace','RLS Promoteur support E2E','Message individuel Promoteur.');
do $test$ declare n integer; begin
  select count(*) into n from public.tickets_support where sujet='RLS Promoteur support E2E';
  if n<>1 then raise exception 'Le Promoteur ne lit pas son ticket'; end if;
end $test$;
reset role;
do $test$
declare d text; n integer;
begin
  select pg_get_functiondef('public.open_naxa_support_ticket(text,text,text)'::regprocedure) into d;
  if position('SECURITY INVOKER' in upper(d))=0 or position('v_business_role' in d)=0 then
    raise exception 'La RPC générique SECURITY INVOKER est absente';
  end if;
  if has_function_privilege('anon','public.open_naxa_support_ticket(text,text,text)','EXECUTE') then
    raise exception 'La RPC support ne doit pas être exécutable par anon';
  end if;
  select count(*) into n from pg_policies where schemaname='storage' and tablename='objects'
    and policyname in ('naxa_support_attachment_insert_own','naxa_support_attachment_read_own','naxa_support_attachment_delete_own');
  if n<>3 then raise exception 'Policies Storage support incomplètes'; end if;
end $test$;
rollback;
