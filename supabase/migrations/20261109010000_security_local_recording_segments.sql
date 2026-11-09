-- NAXA Security — lot 13 : index serveur des segments enregistrés localement.
-- Les octets vidéo restent sur le NVR/passerelle ; cette table ne stocke que des métadonnées privées.
begin;

create table if not exists public.naxa_security_recording_segments (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  gateway_id uuid not null,
  camera_id uuid not null,
  recording_mode text not null default 'continuous'
    check (recording_mode in ('continuous','scheduled','event')),
  status text not null default 'recording'
    check (status in ('recording','ready','protected','degraded','corrupt','deleted','error')),
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds numeric(12,3)
    check (duration_seconds is null or duration_seconds >= 0),
  codec text
    check (codec is null or (length(codec) between 1 and 64 and codec ~ '^[A-Za-z0-9_.-]+$')),
  container_format text not null default 'mp4'
    check (container_format in ('mp4','mkv','webm')),
  storage_path text not null
    check (
      length(storage_path) between 1 and 1024
      and storage_path !~ '(^/|(^|/)\.\.(/|$)|://|[[:cntrl:]])'
    ),
  size_bytes bigint
    check (size_bytes is null or size_bytes > 0),
  sha256 text
    check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  audio_enabled boolean not null default false
    check (audio_enabled = false),
  retention_until timestamptz,
  protected_at timestamptz,
  protected_by uuid references auth.users(id) on delete set null,
  protected_reason text,
  last_error_code text
    check (last_error_code is null or length(last_error_code) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint naxa_security_recording_segments_gateway_fk
    foreign key (gateway_id, pharmacie_id)
    references public.naxa_security_gateways(id, pharmacie_id) on delete restrict,
  constraint naxa_security_recording_segments_camera_fk
    foreign key (camera_id, pharmacie_id)
    references public.naxa_security_cameras(id, pharmacie_id) on delete restrict,
  constraint naxa_security_recording_segments_camera_path_uk
    unique (camera_id, storage_path),
  constraint naxa_security_recording_segments_time_ck
    check (ended_at is null or ended_at >= started_at),
  constraint naxa_security_recording_segments_state_ck
    check (
      (status in ('recording','degraded','error') and ended_at is null)
      or
      (status in ('ready','protected','corrupt','deleted') and ended_at is not null)
    ),
  constraint naxa_security_recording_segments_ready_metadata_ck
    check (
      status not in ('ready','protected')
      or (duration_seconds is not null and codec is not null and size_bytes is not null and sha256 is not null)
    ),
  constraint naxa_security_recording_segments_protected_ck
    check (
      (status = 'protected') =
      (protected_at is not null and protected_reason is not null and btrim(protected_reason) <> '')
    ),
  constraint naxa_security_recording_segments_retention_ck
    check (retention_until is null or retention_until >= started_at)
);

create index if not exists naxa_security_recording_segments_pharmacy_time_idx
  on public.naxa_security_recording_segments (pharmacie_id, started_at desc);
create index if not exists naxa_security_recording_segments_camera_time_idx
  on public.naxa_security_recording_segments (camera_id, started_at desc);
create index if not exists naxa_security_recording_segments_retention_idx
  on public.naxa_security_recording_segments (pharmacie_id, status, retention_until)
  where status in ('ready','protected');

alter table public.naxa_security_recording_segments enable row level security;
alter table public.naxa_security_recording_segments force row level security;
revoke all on public.naxa_security_recording_segments from public, anon, authenticated;
grant all on public.naxa_security_recording_segments to service_role;

alter table public.naxa_security_access_audit
  drop constraint if exists naxa_security_access_audit_action_check;
alter table public.naxa_security_access_audit
  add constraint naxa_security_access_audit_action_check
  check (action in (
    'camera_live_view','clip_view','clip_export',
    'recording_segment_view','recording_segment_export','recording_segment_delete',
    'recording_policy_update',
    'event_acknowledge','event_review','siren_request','siren_confirm','siren_stop',
    'device_read','device_update'
  ));

alter table public.naxa_security_access_audit
  drop constraint if exists naxa_security_access_audit_resource_type_check;
alter table public.naxa_security_access_audit
  add constraint naxa_security_access_audit_resource_type_check
  check (resource_type in (
    'installation','gateway','camera','event','clip','recording_segment','recording_policy','siren_command'
  ));

comment on table public.naxa_security_recording_segments is
  'Index privé des segments vidéo enregistrés localement sur le NVR/passerelle. Les octets restent locaux ; audio interdit ; accès backend uniquement.';
comment on column public.naxa_security_recording_segments.storage_path is
  'Chemin relatif au volume local du NVR ; ne jamais exposer au navigateur ni y inclure une URI ou un secret.';
comment on column public.naxa_security_recording_segments.sha256 is
  'Empreinte du segment fermé, calculée avant publication de son état ready.';

commit;
