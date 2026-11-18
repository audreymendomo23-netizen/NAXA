-- Réouverture des dossiers Assistance NAXA par tout compte demandeur actif.
begin;
create or replace function public.support_chat_mark_first_response()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_ticket public.tickets_support%rowtype; v_profile public.profiles%rowtype; v_prior_messages integer:=0;
begin
 select * into v_ticket from public.tickets_support t where t.id=new.ticket_id;
 if not found then return new; end if;
 select * into v_profile from public.profiles p where p.id=new.auteur_profile_id;
 if v_ticket.type='support_naxa' then
  if new.interne then return new; end if;
  select count(*)::integer into v_prior_messages from public.messages_support m
   where m.ticket_id=new.ticket_id and m.id<>new.id and m.interne=false;
  update public.tickets_support t
  set last_activity_at=new.created_at,
      first_response_at=case when v_profile.role='admin'::public.role_type and v_profile.actif is true
        then coalesce(t.first_response_at,new.created_at) else t.first_response_at end,
      statut=case
        when v_profile.role='admin'::public.role_type and v_profile.actif is true then 'en_attente_client'
        when v_profile.id=v_ticket.auteur_profile_id and v_profile.actif is true
          and v_profile.role<>'admin'::public.role_type and v_prior_messages>0 and t.statut<>'ferme'
          then 'en_cours' else t.statut end,
      resolved_at=case
        when v_profile.id=v_ticket.auteur_profile_id and v_profile.actif is true
          and v_profile.role<>'admin'::public.role_type and v_prior_messages>0 and t.statut<>'ferme'
          then null else t.resolved_at end
  where t.id=new.ticket_id;
  return new;
 end if;
 update public.tickets_support t set first_response_at=coalesce(t.first_response_at,new.created_at),last_activity_at=new.created_at
  where t.id=new.ticket_id and t.first_response_at is null and t.auteur_profile_id<>new.auteur_profile_id
    and t.pharmacie_id=(select p.pharmacie_id from public.profiles p where p.id=new.auteur_profile_id);
 update public.tickets_support t set last_activity_at=new.created_at where t.id=new.ticket_id and t.last_activity_at<new.created_at;
 return new;
end;
$function$;
revoke all on function public.support_chat_mark_first_response() from public,anon,authenticated;
commit;
