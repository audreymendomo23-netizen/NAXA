-- NAXA Sécurité intelligente — réception et validation humaine des appareils découverts.
-- Phase 5 : les rapports ONVIF signés créent des candidats privés ; aucun appareil
-- n'est automatiquement ajouté à l'inventaire actif ou connecté à un flux.

create table if not exists public.naxa_security_camera_discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  gateway_id uuid not null,
  pharmacie_id uuid not null,
  discovery_key text not null
    check (discovery_key ~ '^[0-9a-f]{64}$'),
  device_id text
    check (device_id is null or length(device_id) between 1 and 160),
  source_address inet not null
    check (
      family(source_address) = 4
      and (
        source_address <<= '10.0.0.0/8'::cidr
        or source_address <<= '172.16.0.0/12'::cidr
        or source_address <<= '192.168.0.0/16'::cidr
        or source_address <<= '169.254.0.0/16'::cidr
      )
    ),
  device_types text not null default '' check (length(device_types) <= 512),
  device_scopes text not null default '' check (length(device_scopes) <= 1024),
  endpoints text[] not null
    check (cardinality(endpoints) between 1 and 4),
  status text not null default 'pending'
    check (status in ('pending','accepted','dismissed')),
  camera_id uuid,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint naxa_security_discovery_gateway_fk
    foreign key (gateway_id, pharmacie_id)
    references public.naxa_security_gateways(id, pharmacie_id) on delete restrict,
  constraint naxa_security_discovery_camera_fk
    foreign key (camera_id, pharmacie_id)
    references public.naxa_security_cameras(id, pharmacie_id) on delete restrict,
  constraint naxa_security_discovery_review_state_ck check (
    (status = 'pending' and camera_id is null and reviewed_by is null and reviewed_at is null)
    or
    (status = 'accepted' and camera_id is not null and reviewed_by is not null and reviewed_at is not null)
    or
    (status = 'dismissed' and camera_id is null and reviewed_by is not null and reviewed_at is not null)
  ),
  constraint naxa_security_discovery_endpoint_array_ck check (
    cardinality(endpoints) between 1 and 4
    and array_position(endpoints, null) is null
  ),
  constraint naxa_security_discovery_id_pharmacie_uk unique (id, pharmacie_id),
  constraint naxa_security_discovery_gateway_key_uk unique (gateway_id, discovery_key)
);

create index if not exists naxa_security_discovery_pharmacy_pending_idx
  on public.naxa_security_camera_discovery_candidates (pharmacie_id, status, last_seen_at desc);
create index if not exists naxa_security_discovery_gateway_recent_idx
  on public.naxa_security_camera_discovery_candidates (gateway_id, last_seen_at desc);

alter table public.naxa_security_camera_discovery_candidates enable row level security;
alter table public.naxa_security_camera_discovery_candidates force row level security;

revoke all on public.naxa_security_camera_discovery_candidates from public, anon, authenticated;
grant all on public.naxa_security_camera_discovery_candidates to service_role;

comment on table public.naxa_security_camera_discovery_candidates is
  'Candidats ONVIF reçus d une passerelle authentifiée. Validation Promoteur obligatoire avant création d une caméra.';
comment on column public.naxa_security_camera_discovery_candidates.endpoints is
  'Endpoints HTTP(S) privés découverts localement ; aucun accès automatique, secret ou flux vidéo.';
