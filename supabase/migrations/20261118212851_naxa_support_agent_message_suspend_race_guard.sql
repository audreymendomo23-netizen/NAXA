begin;
create or replace function public.support_chat_mark_first_response()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
  v_ticket public.tickets_support%rowtype;
  v_profile public.profiles%rowtype;
  v_prior_messages integer := 0;
begin
  select * into v_ticket from public.tickets_support t where t.id=new.ticket_id;
  if not found then return new; end if;
  if new.auteur_support_agent_id is not null and v_ticket.type<>'support_naxa' then
    raise exception 'Un Agent NAXA ne peut répondre qu’aux dossiers support NAXA' using errcode='42501';
  end if;
  if v_ticket.type='support_naxa' then
    if new.auteur_support_agent_id is not null then
      perform 1 from public.support_agents a
      where a.user_id=new.auteur_support_agent_id and a.status='active'
      for share;
      if not found then raise exception 'Agent inactif ou suspendu' using errcode='42501'; end if;
      if v_ticket.statut in ('resolu','ferme') or not exists (
        select 1 from public.support_ticket_assignments ta
        join public.support_agent_permissions p on p.agent_user_id=ta.agent_user_id
          and p.permission_code=case when new.interne then 'ticket_internal_note' else 'ticket_reply' end
          and p.revoked_at is null
        where ta.agent_user_id=new.auteur_support_agent_id
          and ta.ticket_id=new.ticket_id and ta.released_at is null
      ) then raise exception 'Agent non autorisé à intervenir sur ce dossier' using errcode='42501'; end if;
      if new.interne then return new; end if;
      update public.tickets_support t set first_response_at=coalesce(t.first_response_at,new.created_at),
        last_activity_at=new.created_at,statut='en_attente_client',resolved_at=null
      where t.id=new.ticket_id;
      return new;
    end if;
    if new.interne then return new; end if;
    select * into v_profile from public.profiles p where p.id=new.auteur_profile_id;
    select count(*)::integer into v_prior_messages from public.messages_support m
      where m.ticket_id=new.ticket_id and m.id<>new.id and m.interne=false;
    update public.tickets_support t set last_activity_at=new.created_at,
      first_response_at=case when v_profile.role='admin'::public.role_type and v_profile.actif is true
        then coalesce(t.first_response_at,new.created_at) else t.first_response_at end,
      statut=case
        when v_profile.role='admin'::public.role_type and v_profile.actif is true then 'en_attente_client'
        when v_profile.id=v_ticket.auteur_profile_id and v_profile.actif is true
          and v_profile.role<>'admin'::public.role_type and v_prior_messages>0 and t.statut<>'ferme'
          then 'en_cours' else t.statut end,
      resolved_at=case when v_profile.id=v_ticket.auteur_profile_id and v_profile.actif is true
        and v_profile.role<>'admin'::public.role_type and v_prior_messages>0 and t.statut<>'ferme'
        then null else t.resolved_at end
    where t.id=new.ticket_id;
    return new;
  end if;
  select * into v_profile from public.profiles p where p.id=new.auteur_profile_id;
  update public.tickets_support t set first_response_at=coalesce(t.first_response_at,new.created_at),
    last_activity_at=new.created_at
  where t.id=new.ticket_id and t.first_response_at is null
    and t.auteur_profile_id<>new.auteur_profile_id and t.pharmacie_id=v_profile.pharmacie_id;
  update public.tickets_support t set last_activity_at=new.created_at
  where t.id=new.ticket_id and t.last_activity_at<new.created_at;
  return new;
end;
$function$;
revoke all on function public.support_chat_mark_first_response() from public,anon,authenticated;
commit;