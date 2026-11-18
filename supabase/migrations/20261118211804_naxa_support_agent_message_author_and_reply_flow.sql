begin;

alter table public.messages_support
  add column if not exists auteur_support_agent_id uuid
  references public.support_agents(user_id) on delete set null;

alter table public.messages_support
  drop constraint if exists messages_support_single_author_identity_ck;
alter table public.messages_support
  add constraint messages_support_single_author_identity_ck
  check (not (auteur_profile_id is not null and auteur_support_agent_id is not null));

create index if not exists messages_support_agent_author_idx
  on public.messages_support(auteur_support_agent_id,created_at desc)
  where auteur_support_agent_id is not null;

create or replace function public.support_chat_mark_first_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_ticket public.tickets_support%rowtype;
  v_profile public.profiles%rowtype;
  v_prior_messages integer := 0;
begin
  select * into v_ticket from public.tickets_support t where t.id=new.ticket_id;
  if not found then return new; end if;

  if v_ticket.type='support_naxa' then
    if new.interne then return new; end if;

    if new.auteur_support_agent_id is not null then
      if v_ticket.statut in ('resolu','ferme')
        or not exists (
          select 1 from public.support_agents a
          join public.support_ticket_assignments ta
            on ta.agent_user_id=a.user_id and ta.ticket_id=new.ticket_id
            and ta.released_at is null
          join public.support_agent_permissions p
            on p.agent_user_id=a.user_id and p.permission_code='ticket_reply'
            and p.revoked_at is null
          where a.user_id=new.auteur_support_agent_id and a.status='active'
        ) then
        raise exception 'Agent non autorisé à répondre à ce dossier' using errcode='42501';
      end if;

      update public.tickets_support t
      set first_response_at=coalesce(t.first_response_at,new.created_at),
          last_activity_at=new.created_at,
          statut='en_attente_client',
          resolved_at=null
      where t.id=new.ticket_id;
      return new;
    end if;

    select * into v_profile from public.profiles p where p.id=new.auteur_profile_id;
    select count(*)::integer into v_prior_messages
    from public.messages_support m
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

  select * into v_profile from public.profiles p where p.id=new.auteur_profile_id;
  update public.tickets_support t
  set first_response_at=coalesce(t.first_response_at,new.created_at),last_activity_at=new.created_at
  where t.id=new.ticket_id and t.first_response_at is null
    and t.auteur_profile_id<>new.auteur_profile_id
    and t.pharmacie_id=v_profile.pharmacie_id;
  update public.tickets_support t
  set last_activity_at=new.created_at
  where t.id=new.ticket_id and t.last_activity_at<new.created_at;
  return new;
end;
$function$;

revoke all on function public.support_chat_mark_first_response() from public,anon,authenticated;

create or replace function private.naxa_support_notify_agent_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_ticket public.tickets_support%rowtype;
begin
  if new.interne or new.auteur_support_agent_id is null then return new; end if;

  select * into v_ticket
  from public.tickets_support t
  where t.id=new.ticket_id and t.type='support_naxa' and t.pharmacie_id is null;

  if not found or v_ticket.auteur_profile_id is null then return new; end if;

  if not exists (
    select 1 from public.support_agents a
    join public.support_ticket_assignments ta
      on ta.agent_user_id=a.user_id and ta.ticket_id=v_ticket.id and ta.released_at is null
    join public.support_agent_permissions p
      on p.agent_user_id=a.user_id and p.permission_code='ticket_reply' and p.revoked_at is null
    where a.user_id=new.auteur_support_agent_id and a.status='active'
  ) then
    raise exception 'Notification refusée : Agent non affecté ou sans permission' using errcode='42501';
  end if;

  insert into public.notifications(user_id,type,titre,corps,related_entity_id)
  values(
    v_ticket.auteur_profile_id,
    'support_naxa_reponse',
    'L’équipe NAXA vous a répondu',
    'Une réponse est disponible pour votre demande '||v_ticket.reference_code||'.',
    v_ticket.id
  );

  return new;
end;
$function$;

revoke all on function private.naxa_support_notify_agent_reply() from public,anon,authenticated;
drop trigger if exists trg_naxa_support_notify_agent_reply on public.messages_support;
create trigger trg_naxa_support_notify_agent_reply
after insert on public.messages_support
for each row execute function private.naxa_support_notify_agent_reply();

commit;