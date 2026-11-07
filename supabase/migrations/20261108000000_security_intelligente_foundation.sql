-- NAXA Sécurité intelligente — fondation technique multi-pharmacie
-- Phase 1 : registre privé. Aucun flux vidéo, upload, IA d'alarme ou relais sirène activé.

create table if not exists public.naxa_security_installations (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null unique references public.pharmacies(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','inventory','awaiting_review','pilot_ready','pilot_active','suspended','retired')),
  legal_review_status text not null default 'not_started' check (legal_review_status in ('not_started','pending','approved','rejected')),
  privacy_notice_status text not null default 'not_started' check (privacy_notice_status in ('not_started','draft','displayed','approved')),
  site_inventory jsonb not null default '{}'::jsonb check (jsonb_typeof(site_inventory) = 'object'),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint naxa_security_installations_pilot_gate_ck check (
    status not in ('pilot_ready','pilot_active')
    or (legal_review_status = 'approved' and privacy_notice_status = 'approved' and approved_by is not null and approved_at is not null)
  ),
  constraint naxa_security_installations_id_pharmacie_uk unique (id, pharmacie_id)
);

create table if not exists public.naxa_security_gateways (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  installation_id uuid not null,
  label text not null,
  serial_number text,
  firmware_version text,
  connection_mode text not null default 'outbound_tunnel' check (connection_mode = 'outbound_tunnel'),
  tunnel_status text not null default 'not_configured' check (tunnel_status in ('not_configured','pending','connected','degraded','disconnected','revoked')),
  secret_reference text,
  last_seen_at timestamptz,
  health_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(health_metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint naxa_security_gateways_installation_fk foreign key (installation_id, pharmacie_id)
    references public.naxa_security_installations(id, pharmacie_id) on delete restrict,
  constraint naxa_security_gateways_id_pharmacie_uk unique (id, pharmacie_id)
);

create table if not exists public.naxa_security_cameras (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  gateway_id uuid not null,
  channel_key text not null,
  manufacturer text,
  model text,
  firmware_version text,
  zone_label text not null,
  onvif_profiles text[] not null default '{}'::text[] check (onvif_profiles <@ array['T','G','M']::text[]),
  status text not null default 'registered' check (status in ('registered','online','offline','degraded','disabled','retired')),
  capabilities jsonb not null default '{}'::jsonb check (jsonb_typeof(capabilities) = 'object'),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint naxa_security_cameras_gateway_fk foreign key (gateway_id, pharmacie_id)
    references public.naxa_security_gateways(id, pharmacie_id) on delete restrict,
  constraint naxa_security_cameras_channel_uk unique (gateway_id, channel_key),
  constraint naxa_security_cameras_id_pharmacie_uk unique (id, pharmacie_id)
);

create table if not exists public.naxa_security_events (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  gateway_id uuid not null,
  camera_id uuid,
  event_type text not null check (event_type in ('motion','intrusion','line_crossing','camera_tamper','camera_obstructed','signal_lost','after_hours_presence','system_offline','other')),
  source_type text not null check (source_type in ('onvif','edge_ai','gateway','operator')),
  severity text not null default 'info' check (severity in ('info','warning','high','critical')),
  status text not null default 'new' check (status in ('new','acknowledged','in_review','false_positive','confirmed','closed')),
  summary text not null,
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  detected_at timestamptz not null,
  received_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  event_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(event_metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint naxa_security_events_gateway_fk foreign key (gateway_id, pharmacie_id)
    references public.naxa_security_gateways(id, pharmacie_id) on delete restrict,
  constraint naxa_security_events_camera_fk foreign key (camera_id, pharmacie_id)
    references public.naxa_security_cameras(id, pharmacie_id) on delete restrict,
  constraint naxa_security_events_human_review_ck check (
    status not in ('acknowledged','false_positive','confirmed','closed')
    or (reviewed_by is not null and reviewed_at is not null)
  ),
  constraint naxa_security_events_id_pharmacie_uk unique (id, pharmacie_id)
);

create table if not exists public.naxa_security_clips (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  event_id uuid not null,
  bucket_id text not null default 'naxa-security-private' check (bucket_id = 'naxa-security-private'),
  object_path text not null,
  content_type text not null check (content_type in ('video/mp4','video/webm','image/jpeg','image/png')),
  size_bytes bigint not null check (size_bytes > 0),
  duration_seconds numeric(10,2) check (duration_seconds is null or duration_seconds >= 0),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  pre_event_seconds integer not null default 10 check (pre_event_seconds between 0 and 600),
  post_event_seconds integer not null default 30 check (post_event_seconds between 0 and 600),
  retention_until timestamptz,
  created_at timestamptz not null default now(),
  constraint naxa_security_clips_event_fk foreign key (event_id, pharmacie_id)
    references public.naxa_security_events(id, pharmacie_id) on delete restrict,
  constraint naxa_security_clips_object_uk unique (bucket_id, object_path)
);

create table if not exists public.naxa_security_siren_commands (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  gateway_id uuid not null,
  command_type text not null check (command_type in ('test','activate','deactivate')),
  status text not null default 'draft' check (status in ('draft','awaiting_confirmation','confirmed','dispatched','acknowledged','rejected','expired','failed','cancelled')),
  requested_by uuid not null references auth.users(id) on delete restrict,
  confirmed_by uuid references auth.users(id) on delete restrict,
  confirmed_at timestamptz,
  reason text not null,
  nonce uuid not null default gen_random_uuid() unique,
  idempotency_key text not null unique,
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  dispatched_at timestamptz,
  acknowledged_at timestamptz,
  result_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(result_metadata) = 'object'),
  created_at timestamptz not null default now(),
  constraint naxa_security_siren_gateway_fk foreign key (gateway_id, pharmacie_id)
    references public.naxa_security_gateways(id, pharmacie_id) on delete restrict,
  constraint naxa_security_siren_confirmation_ck check (
    status not in ('confirmed','dispatched','acknowledged')
    or (confirmed_by is not null and confirmed_at is not null)
  )
);

create table if not exists public.naxa_security_access_audit (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text not null check (actor_role in ('promoteur','responsable','admin','system')),
  action text not null check (action in ('camera_live_view','clip_view','clip_export','event_acknowledge','event_review','siren_request','siren_confirm','siren_stop','device_read','device_update')),
  resource_type text not null check (resource_type in ('installation','gateway','camera','event','clip','siren_command')),
  resource_id uuid,
  justification text,
  audit_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(audit_metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists naxa_security_gateways_pharmacie_idx on public.naxa_security_gateways (pharmacie_id, tunnel_status);
create index if not exists naxa_security_cameras_pharmacie_idx on public.naxa_security_cameras (pharmacie_id, status);
create index if not exists naxa_security_events_pharmacie_date_idx on public.naxa_security_events (pharmacie_id, detected_at desc);
create index if not exists naxa_security_events_status_date_idx on public.naxa_security_events (pharmacie_id, status, detected_at desc);
create index if not exists naxa_security_clips_event_idx on public.naxa_security_clips (event_id);
create index if not exists naxa_security_siren_commands_pharmacie_date_idx on public.naxa_security_siren_commands (pharmacie_id, created_at desc);
create index if not exists naxa_security_access_audit_pharmacie_date_idx on public.naxa_security_access_audit (pharmacie_id, created_at desc);

create or replace function public.naxa_security_audit_reject_mutation()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  raise exception 'NAXA security access audit is append-only';
end;
$function$;

revoke all on function public.naxa_security_audit_reject_mutation() from public, anon, authenticated;
drop trigger if exists naxa_security_access_audit_immutable_trg on public.naxa_security_access_audit;
create trigger naxa_security_access_audit_immutable_trg
before update or delete on public.naxa_security_access_audit
for each row execute function public.naxa_security_audit_reject_mutation();

alter table public.naxa_security_installations enable row level security;
alter table public.naxa_security_installations force row level security;
alter table public.naxa_security_gateways enable row level security;
alter table public.naxa_security_gateways force row level security;
alter table public.naxa_security_cameras enable row level security;
alter table public.naxa_security_cameras force row level security;
alter table public.naxa_security_events enable row level security;
alter table public.naxa_security_events force row level security;
alter table public.naxa_security_clips enable row level security;
alter table public.naxa_security_clips force row level security;
alter table public.naxa_security_siren_commands enable row level security;
alter table public.naxa_security_siren_commands force row level security;
alter table public.naxa_security_access_audit enable row level security;
alter table public.naxa_security_access_audit force row level security;

revoke all on public.naxa_security_installations, public.naxa_security_gateways, public.naxa_security_cameras,
  public.naxa_security_events, public.naxa_security_clips, public.naxa_security_siren_commands, public.naxa_security_access_audit
from public, anon, authenticated;
grant all on public.naxa_security_installations, public.naxa_security_gateways, public.naxa_security_cameras,
  public.naxa_security_events, public.naxa_security_clips, public.naxa_security_siren_commands, public.naxa_security_access_audit
to service_role;

comment on table public.naxa_security_installations is 'Registre par pharmacie. Pilote bloqué tant que validation juridique et information des personnes non approuvées.';
comment on table public.naxa_security_gateways is 'Passerelles locales : tunnel sortant uniquement ; secret_reference ne contient aucun secret en clair.';
comment on table public.naxa_security_cameras is 'Inventaire ONVIF rattaché à une passerelle et à une pharmacie unique.';
comment on table public.naxa_security_events is 'Événements techniques/analytiques ; qualification définitive soumise à revue humaine.';
comment on table public.naxa_security_clips is 'Métadonnées de clips destinés au futur stockage privé ; aucune URL publique ni écriture client.';
comment on table public.naxa_security_siren_commands is 'Registre de commandes sirène ; aucun worker de déclenchement matériel dans cette phase.';
comment on table public.naxa_security_access_audit is 'Journal append-only des accès, exports, revues et commandes du module Sécurité intelligente.';
