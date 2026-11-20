begin;

alter table public.support_call_events
  drop constraint if exists support_call_events_event_code_check;

alter table public.support_call_events
  add constraint support_call_events_event_code_check
  check (event_code in (
    'call_requested','call_routed','call_accepted','call_declined',
    'call_cancelled','call_completed','call_reassigned','call_failed',
    'screen_share_consented','screen_share_started',
    'screen_share_stopped','screen_share_denied'
  ));

create unique index if not exists support_call_screen_share_event_once_uq
  on public.support_call_events(
    call_id,
    (details->>'share_session_id'),
    event_code
  )
  where event_code in (
    'screen_share_consented','screen_share_started',
    'screen_share_stopped','screen_share_denied'
  )
  and details ? 'share_session_id';

create or replace function private.naxa_support_call_screen_share_event(
  p_call_id uuid,
  p_actor_user_id uuid,
  p_share_session_id uuid,
  p_action text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_call public.support_calls%rowtype;
  v_event_code text;
  v_details jsonb;
  v_valid_reason boolean;
begin
  if p_actor_user_id is null or p_share_session_id is null then
    raise exception 'Participant ou session de partage invalide';
  end if;
  if p_action not in ('consented','started','stopped','denied') then
    raise exception 'Événement de partage non autorisé';
  end if;
  v_valid_reason := p_reason is null or p_reason in (
    'browser_permission_denied','browser_unsupported','user_cancelled',
    'user_stopped','call_ended','requester_disconnected','unexpected_track_end'
  );
  if not v_valid_reason then raise exception 'Motif de partage non autorisé'; end if;

  select * into v_call from public.support_calls where id=p_call_id for update;
  if not found or v_call.requester_user_id is distinct from p_actor_user_id then
    raise exception 'Seul le demandeur de cet appel peut partager son écran';
  end if;

  if p_action <> 'stopped' then
    if v_call.status <> 'accepted' then
      raise exception 'L’appel doit être accepté pour partager un écran';
    end if;
    if not exists (
      select 1
      from public.tickets_support t
      join public.profiles p on p.id=t.auteur_profile_id
      where t.id=v_call.ticket_id
        and t.type='support_naxa'
        and t.statut not in ('resolu','ferme')
        and p.id=p_actor_user_id
        and p.actif is true
    ) then
      raise exception 'Le dossier ou le profil du demandeur n’est plus actif';
    end if;
  end if;

  if p_action='consented' then
    v_event_code:='screen_share_consented';
    v_details:=jsonb_build_object('share_session_id',p_share_session_id);
  elsif p_action='started' then
    if not exists (
      select 1 from public.support_call_events e
      where e.call_id=p_call_id
        and e.event_code='screen_share_consented'
        and e.details->>'share_session_id'=p_share_session_id::text
    ) then raise exception 'Consentement de partage absent'; end if;
    if exists (
      select 1 from public.support_call_events e
      where e.call_id=p_call_id
        and e.event_code='screen_share_started'
        and e.details->>'share_session_id'=p_share_session_id::text
    ) then return; end if;
    v_event_code:='screen_share_started';
    v_details:=jsonb_build_object('share_session_id',p_share_session_id);
  elsif p_action='denied' then
    v_event_code:='screen_share_denied';
    v_details:=jsonb_build_object(
      'share_session_id',p_share_session_id,
      'reason',coalesce(p_reason,'browser_permission_denied')
    );
  else
    if not exists (
      select 1 from public.support_call_events e
      where e.call_id=p_call_id
        and e.event_code='screen_share_started'
        and e.details->>'share_session_id'=p_share_session_id::text
    ) then return; end if;
    if exists (
      select 1 from public.support_call_events e
      where e.call_id=p_call_id
        and e.event_code='screen_share_stopped'
        and e.details->>'share_session_id'=p_share_session_id::text
    ) then return; end if;
    v_event_code:='screen_share_stopped';
    v_details:=jsonb_build_object(
      'share_session_id',p_share_session_id,
      'reason',coalesce(p_reason,'user_stopped')
    );
  end if;

  insert into public.support_call_events(call_id,actor_user_id,event_code,details)
  values(p_call_id,p_actor_user_id,v_event_code,v_details)
  on conflict do nothing;
end;
$function$;

revoke all on function private.naxa_support_call_screen_share_event(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function private.naxa_support_call_screen_share_event(uuid,uuid,uuid,text,text)
  to service_role;

create or replace function private.naxa_support_call_close_screen_shares()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare v_session_id uuid;
begin
  if new.status in ('completed','cancelled','declined','failed','missed')
     and old.status is distinct from new.status then
    for v_session_id in
      select distinct (e.details->>'share_session_id')::uuid
      from public.support_call_events e
      where e.call_id=new.id
        and e.event_code='screen_share_started'
        and e.details ? 'share_session_id'
        and not exists (
          select 1 from public.support_call_events stopped
          where stopped.call_id=e.call_id
            and stopped.event_code='screen_share_stopped'
            and stopped.details->>'share_session_id'=e.details->>'share_session_id'
        )
    loop
      insert into public.support_call_events(call_id,actor_user_id,event_code,details)
      values(
        new.id,
        null,
        'screen_share_stopped',
        jsonb_build_object('share_session_id',v_session_id,'reason','call_ended')
      )
      on conflict do nothing;
    end loop;
  end if;
  return new;
end;
$function$;

revoke all on function private.naxa_support_call_close_screen_shares()
  from public,anon,authenticated;

drop trigger if exists trg_naxa_support_call_close_screen_shares on public.support_calls;
create trigger trg_naxa_support_call_close_screen_shares
after update of status on public.support_calls
for each row
when (
  new.status in ('completed','cancelled','declined','failed','missed')
  and old.status is distinct from new.status
)
execute function private.naxa_support_call_close_screen_shares();

comment on function private.naxa_support_call_screen_share_event(uuid,uuid,uuid,text,text)
  is 'Journalise consentement et cycle de vie du partage écran. Aucune image, vidéo, source d’écran ou donnée de capture n’est stockée.';

commit;
