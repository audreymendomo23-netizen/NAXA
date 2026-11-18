-- Les notifications de l'assistance directe sont neutres et couvrent Client et professionnel.
begin;
create or replace function private.naxa_support_notify_new_ticket()
returns trigger language plpgsql security definer set search_path=''
as $function$
begin
  if new.type<>'support_naxa' or new.pharmacie_id is not null then return new; end if;
  insert into public.notifications(user_id,type,titre,corps,related_entity_id)
  select p.id,'support_naxa_nouvelle_demande','Nouvelle demande d’assistance NAXA',
    'Une nouvelle demande NAXA attend son traitement : '||new.reference_code||'.',new.id
  from public.profiles p where p.role='admin'::public.role_type and p.actif is true;
  return new;
end;
$function$;
create or replace function private.naxa_support_notify_client_reply()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_ticket public.tickets_support%rowtype; v_prior_messages integer:=0;
begin
  if new.interne or new.auteur_profile_id is null then return new; end if;
  select * into v_ticket from public.tickets_support t
    where t.id=new.ticket_id and t.type='support_naxa' and t.pharmacie_id is null;
  if not found or new.auteur_profile_id<>v_ticket.auteur_profile_id then return new; end if;
  select count(*)::integer into v_prior_messages from public.messages_support m
    where m.ticket_id=new.ticket_id and m.id<>new.id and m.interne=false;
  if v_prior_messages=0 then return new; end if;
  insert into public.notifications(user_id,type,titre,corps,related_entity_id)
  select p.id,'support_naxa_nouveau_message','Nouveau message sur une demande d’assistance NAXA',
    'Le demandeur a répondu dans la demande '||v_ticket.reference_code||'.',v_ticket.id
  from public.profiles p where p.role='admin'::public.role_type and p.actif is true;
  return new;
end;
$function$;
revoke all on function private.naxa_support_notify_new_ticket() from public,anon,authenticated;
revoke all on function private.naxa_support_notify_client_reply() from public,anon,authenticated;
commit;
