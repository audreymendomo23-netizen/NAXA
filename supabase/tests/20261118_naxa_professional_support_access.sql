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
update public.tickets_support set statut='resolu',resolved_at=now()
where sujet='RLS Promoteur support E2E' and type='support_naxa';
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',(select id::text from public.profiles where username='naxa_e2e_promoteur'))::text,true);
set local role authenticated;
insert into public.messages_support(ticket_id,auteur_profile_id,contenu,interne)
select t.id,(select id from public.profiles where username='naxa_e2e_promoteur'),'Réouverture professionnelle E2E',false
from public.tickets_support t where t.sujet='RLS Promoteur support E2E';
do $test$ declare s text; resolved timestamptz; begin
 select statut,resolved_at into s,resolved from public.tickets_support where sujet='RLS Promoteur support E2E';
 if s<>'en_cours' or resolved is not null then raise exception 'Le Promoteur ne rouvre pas son dossier résolu'; end if;
end $test$;
reset role;
update public.tickets_support set statut='ferme',resolved_at=now() where sujet='RLS Promoteur support E2E';
select set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',(select id::text from public.profiles where username='naxa_e2e_promoteur'))::text,true);
set local role authenticated;
do $test$ declare rejected boolean:=false; begin
 begin
  insert into public.messages_support(ticket_id,auteur_profile_id,contenu,interne)
  select t.id,(select id from public.profiles where username='naxa_e2e_promoteur'),'Message interdit dossier fermé',false
  from public.tickets_support t where t.sujet='RLS Promoteur support E2E';
 exception when insufficient_privilege then rejected:=true;
 end;
 if not rejected then raise exception 'Un message a pu être ajouté à un dossier fermé'; end if;
end $test$;
reset role;
do $test$
declare d text; n integer;
begin
  select pg_get_functiondef('public.open_naxa_support_ticket(text,text,text)'::regprocedure) into d;
  if position('v_business_role' in d)=0 then
    raise exception 'La RPC générique SECURITY INVOKER est absente';
  end if;
  if (select prosecdef from pg_proc where oid='public.open_naxa_support_ticket(text,text,text)'::regprocedure) is distinct from false then raise exception 'La RPC doit rester SECURITY INVOKER'; end if;
  if has_function_privilege('anon','public.open_naxa_support_ticket(text,text,text)','EXECUTE') then
    raise exception 'La RPC support ne doit pas être exécutable par anon';
  end if;
  select count(*) into n from pg_policies where schemaname='storage' and tablename='objects'
    and policyname in ('naxa_support_attachment_insert_own','naxa_support_attachment_read_own','naxa_support_attachment_delete_own');
  if n<>3 then raise exception 'Policies Storage support incomplètes'; end if;
  select count(*) into n from public.notifications no
    join public.tickets_support t on t.id=no.related_entity_id
    where t.sujet in ('RLS Livreur support E2E','RLS Promoteur support E2E')
      and no.type='support_naxa_nouvelle_demande';
  if n<2 then raise exception 'Notifications Admin absentes pour les professionnels'; end if;
  if position('demandeur' in lower(pg_get_functiondef('private.naxa_support_notify_client_reply()'::regprocedure)))=0
     then raise exception 'Notification de réponse encore libellée Client'; end if;
end $test$;
rollback;
