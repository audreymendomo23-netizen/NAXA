begin;

create or replace function private.naxa_support_call_close_screen_shares()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_session_id uuid;
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

comment on function private.naxa_support_call_close_screen_shares()
  is 'À la clôture d’un appel, journalise l’arrêt du partage avec un acteur système NULL ; aucune donnée média n’est stockée.';

commit;
