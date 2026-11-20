begin;

create or replace function public.naxa_support_call_screen_share_event(
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
begin
  perform private.naxa_support_call_screen_share_event(
    p_call_id,
    p_actor_user_id,
    p_share_session_id,
    p_action,
    p_reason
  );
end;
$function$;

revoke all on function public.naxa_support_call_screen_share_event(uuid,uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.naxa_support_call_screen_share_event(uuid,uuid,uuid,text,text)
  to service_role;

comment on function public.naxa_support_call_screen_share_event(uuid,uuid,uuid,text,text)
  is 'Wrapper PostgREST public restreint à service_role ; délègue au RPC privé de journalisation du partage écran.';

commit;
