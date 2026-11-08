-- NAXA Sécurité intelligente — tickets WebRTC à durée courte.
-- Aucun URL RTSP ni secret caméra n'est stocké ou transmis au navigateur.

create table if not exists public.naxa_security_live_sessions (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  camera_id uuid not null,
  gateway_id uuid not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  token_sha256 text not null unique check (token_sha256 ~ '^[0-9a-f]{64}$'),
  media_path text not null check (media_path ~ '^naxa/[0-9a-f-]{36}/[0-9a-f-]{36}$'),
  status text not null default 'active' check (status in ('active','revoked','expired')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint naxa_security_live_session_camera_fk
    foreign key (camera_id, pharmacie_id)
    references public.naxa_security_cameras(id, pharmacie_id) on delete restrict,
  constraint naxa_security_live_session_gateway_fk
    foreign key (gateway_id, pharmacie_id)
    references public.naxa_security_gateways(id, pharmacie_id) on delete restrict,
  constraint naxa_security_live_session_path_ck
    check (media_path = 'naxa/' || pharmacie_id::text || '/' || camera_id::text),
  constraint naxa_security_live_session_expiry_ck
    check (expires_at > issued_at and expires_at <= issued_at + interval '15 minutes 5 seconds'),
  constraint naxa_security_live_session_revocation_ck
    check ((status = 'revoked') = (revoked_at is not null))
);

create index if not exists naxa_security_live_sessions_user_active_idx
  on public.naxa_security_live_sessions(user_id, expires_at)
  where status = 'active';
create index if not exists naxa_security_live_sessions_camera_active_idx
  on public.naxa_security_live_sessions(camera_id, expires_at)
  where status = 'active';

alter table public.naxa_security_live_sessions enable row level security;
alter table public.naxa_security_live_sessions force row level security;
revoke all on public.naxa_security_live_sessions from public, anon, authenticated;
grant all on public.naxa_security_live_sessions to service_role;

create or replace function public.naxa_security_issue_live_session(
  p_pharmacie_id uuid,
  p_camera_id uuid,
  p_gateway_id uuid,
  p_user_id uuid,
  p_token_sha256 text,
  p_media_path text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_session_id uuid;
  v_active_count integer;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if p_pharmacie_id is null
    or p_camera_id is null
    or p_gateway_id is null
    or p_user_id is null
    or p_token_sha256 is null
    or p_media_path is null
    or p_expires_at is null
    or p_token_sha256 !~ '^[0-9a-f]{64}$'
    or p_media_path <> ('naxa/' || p_pharmacie_id::text || '/' || p_camera_id::text)
    or p_expires_at <= v_now
    or p_expires_at > v_now + interval '15 minutes 5 seconds'
    or not exists (
      select 1
        from public.naxa_security_cameras as camera
       where camera.id = p_camera_id
         and camera.pharmacie_id = p_pharmacie_id
         and camera.gateway_id = p_gateway_id
    )
  then
    raise exception 'NAXA live session arguments rejected'
      using errcode = '22023';
  end if;

  -- Serialise les créations par compte : quatre lectures simultanées au maximum.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text, 0)
  );

  select pg_catalog.count(*)::integer
    into v_active_count
    from public.naxa_security_live_sessions
   where user_id = p_user_id
     and status = 'active'
     and expires_at > v_now;

  if v_active_count >= 4 then
    raise exception 'NAXA live session limit reached'
      using errcode = '54000';
  end if;

  insert into public.naxa_security_live_sessions (
    pharmacie_id, camera_id, gateway_id, user_id,
    token_sha256, media_path, status, issued_at, expires_at
  ) values (
    p_pharmacie_id, p_camera_id, p_gateway_id, p_user_id,
    p_token_sha256, p_media_path, 'active', v_now, p_expires_at
  )
  returning id into v_session_id;

  insert into public.naxa_security_access_audit (
    pharmacie_id, actor_id, actor_role, action,
    resource_type, resource_id, justification, audit_metadata
  ) values (
    p_pharmacie_id, p_user_id, 'promoteur', 'camera_live_view',
    'camera', p_camera_id, 'Ouverture d’une session vidéo WebRTC autorisée',
    pg_catalog.jsonb_build_object(
      'session_id', v_session_id,
      'gateway_id', p_gateway_id,
      'media_path', p_media_path,
      'expires_at', p_expires_at
    )
  );

  return v_session_id;
end;
$function$;

revoke all on function public.naxa_security_issue_live_session(
  uuid, uuid, uuid, uuid, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.naxa_security_issue_live_session(
  uuid, uuid, uuid, uuid, text, text, timestamptz
) to service_role;

comment on table public.naxa_security_live_sessions is
  'Tickets WebRTC temporaires : seul le hash SHA-256 est stocké ; lecture limitée à une caméra, un Promoteur et un chemin média.';
comment on function public.naxa_security_issue_live_session(
  uuid, uuid, uuid, uuid, text, text, timestamptz
) is
  'Création atomique d’un ticket média et de son audit ; exécution réservée au service_role, quatre sessions actives maximum par Promoteur.';
