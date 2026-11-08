create table if not exists public.naxa_security_stream_publish_tickets (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  camera_id uuid not null,
  gateway_id uuid not null,
  token_sha256 text not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
  media_path text not null check (media_path ~ '^naxa/[0-9a-f-]{36}/[0-9a-f-]{36}$'),
  status text not null default 'active' check (status in ('active','revoked','expired')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint naxa_security_publish_camera_fk foreign key (camera_id, pharmacie_id)
    references public.naxa_security_cameras(id, pharmacie_id) on delete restrict,
  constraint naxa_security_publish_gateway_fk foreign key (gateway_id, pharmacie_id)
    references public.naxa_security_gateways(id, pharmacie_id) on delete restrict,
  constraint naxa_security_publish_path_ck
    check (media_path = 'naxa/' || pharmacie_id::text || '/' || camera_id::text),
  constraint naxa_security_publish_expiry_ck
    check (expires_at > issued_at and expires_at <= issued_at + interval '15 minutes 5 seconds'),
  constraint naxa_security_publish_revocation_ck
    check ((status = 'revoked') = (revoked_at is not null))
);

create index if not exists naxa_security_publish_gateway_active_idx
  on public.naxa_security_stream_publish_tickets(gateway_id, expires_at) where status = 'active';
create index if not exists naxa_security_publish_camera_active_idx
  on public.naxa_security_stream_publish_tickets(camera_id, expires_at) where status = 'active';

alter table public.naxa_security_stream_publish_tickets enable row level security;
alter table public.naxa_security_stream_publish_tickets force row level security;
revoke all on public.naxa_security_stream_publish_tickets from public, anon, authenticated;
grant all on public.naxa_security_stream_publish_tickets to service_role;

create or replace function public.naxa_security_issue_stream_publish_ticket(
  p_pharmacie_id uuid, p_camera_id uuid, p_gateway_id uuid,
  p_token_sha256 text, p_media_path text, p_expires_at timestamptz
)
returns uuid language plpgsql security invoker set search_path = ''
as $function$
declare
  v_ticket_id uuid;
  v_active_count integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_pharmacie_id is null or p_camera_id is null or p_gateway_id is null
    or p_token_sha256 is null or p_media_path is null or p_expires_at is null
    or p_token_sha256 !~ '^[0-9a-f]{64}$'
    or p_media_path <> ('naxa/' || p_pharmacie_id::text || '/' || p_camera_id::text)
    or p_expires_at <= v_now or p_expires_at > v_now + interval '15 minutes 5 seconds'
    or not exists (
      select 1 from public.naxa_security_cameras as camera
       where camera.id = p_camera_id and camera.pharmacie_id = p_pharmacie_id
         and camera.gateway_id = p_gateway_id and camera.status not in ('disabled','retired')
    )
  then
    raise exception 'NAXA publish ticket arguments rejected' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_gateway_id::text, 0));
  select pg_catalog.count(*)::integer into v_active_count
    from public.naxa_security_stream_publish_tickets
   where gateway_id = p_gateway_id and status = 'active' and expires_at > v_now;
  if v_active_count >= 32 then
    raise exception 'NAXA gateway publish ticket limit reached' using errcode = '54000';
  end if;

  insert into public.naxa_security_stream_publish_tickets (
    pharmacie_id, camera_id, gateway_id, token_sha256, media_path, status, issued_at, expires_at
  ) values (
    p_pharmacie_id, p_camera_id, p_gateway_id, p_token_sha256, p_media_path, 'active', v_now, p_expires_at
  ) returning id into v_ticket_id;

  insert into public.naxa_security_access_audit (
    pharmacie_id, actor_id, actor_role, action, resource_type, resource_id, justification, audit_metadata
  ) values (
    p_pharmacie_id, null, 'system', 'device_update', 'camera', p_camera_id,
    'Ticket de publication RTSPS émis à la passerelle enrôlée',
    pg_catalog.jsonb_build_object('ticket_id', v_ticket_id, 'gateway_id', p_gateway_id,
      'media_path', p_media_path, 'expires_at', p_expires_at)
  );
  return v_ticket_id;
end;
$function$;

create or replace function public.naxa_security_report_stream_health(
  p_pharmacie_id uuid, p_camera_id uuid, p_gateway_id uuid, p_state text, p_frame_count bigint
)
returns boolean language plpgsql security invoker set search_path = ''
as $function$
declare
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_changed integer;
begin
  if p_pharmacie_id is null or p_camera_id is null or p_gateway_id is null
    or p_state is null or p_state not in ('online','offline')
    or p_frame_count is null or p_frame_count < 0
    or (p_state = 'online' and p_frame_count < 1)
  then
    raise exception 'NAXA stream health arguments rejected' using errcode = '22023';
  end if;

  update public.naxa_security_cameras as camera
     set status = p_state,
         last_seen_at = case when p_state = 'online' then v_now else camera.last_seen_at end,
         updated_at = v_now
   where camera.id = p_camera_id and camera.pharmacie_id = p_pharmacie_id
     and camera.gateway_id = p_gateway_id and camera.status not in ('disabled','retired');
  get diagnostics v_changed = row_count;
  if v_changed <> 1 then
    raise exception 'NAXA camera is outside gateway scope' using errcode = '42501';
  end if;

  insert into public.naxa_security_access_audit (
    pharmacie_id, actor_id, actor_role, action, resource_type, resource_id, justification, audit_metadata
  ) values (
    p_pharmacie_id, null, 'system', 'device_update', 'camera', p_camera_id,
    'État du flux remonté par la passerelle signée',
    pg_catalog.jsonb_build_object('gateway_id', p_gateway_id, 'state', p_state,
      'frame_count', p_frame_count, 'reported_at', v_now)
  );
  return true;
end;
$function$;

revoke all on function public.naxa_security_issue_stream_publish_ticket(uuid,uuid,uuid,text,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.naxa_security_issue_stream_publish_ticket(uuid,uuid,uuid,text,text,timestamptz)
  to service_role;
revoke all on function public.naxa_security_report_stream_health(uuid,uuid,uuid,text,bigint)
  from public, anon, authenticated;
grant execute on function public.naxa_security_report_stream_health(uuid,uuid,uuid,text,bigint)
  to service_role;
