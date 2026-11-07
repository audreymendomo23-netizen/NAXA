-- NAXA Sécurité intelligente — connectivité universelle multi-marques.
-- Tous les accès matériels passent par une passerelle locale. Aucun secret caméra en clair.

create table if not exists public.naxa_security_camera_adapters (
  adapter_key text primary key,
  manufacturer_key text not null,
  display_name text not null,
  protocol text not null
    check (protocol in ('onvif','rtsp','rtsps','http_api','https_api','vendor_sdk','nvr_channel','analog_encoder','cloud_api')),
  integration_status text not null default 'design_only'
    check (integration_status in ('design_only','in_development','validated','disabled')),
  supported_capabilities text[] not null default '{}'::text[]
    check (supported_capabilities <@ array[
      'discovery','live_view','playback','recording','ptz','events','analytics',
      'motion','tamper','audio','two_way_audio','snapshot','health','io_control'
    ]::text[]),
  official_interface_only boolean not null default true,
  requires_firmware_validation boolean not null default true,
  documentation_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.naxa_security_camera_adapters
  (adapter_key, manufacturer_key, display_name, protocol, integration_status, notes)
values
  ('generic.onvif', 'multi_vendor', 'ONVIF générique', 'onvif', 'design_only', 'Découverte, profils, flux et événements selon capacités constatées.'),
  ('generic.rtsp', 'multi_vendor', 'RTSP générique', 'rtsp', 'design_only', 'Flux vidéo local lorsque le fabricant expose une URI RTSP documentée.'),
  ('generic.rtsps', 'multi_vendor', 'RTSPS générique', 'rtsps', 'design_only', 'Flux RTSP chiffré lorsque le modèle et firmware le permettent.'),
  ('generic.http_snapshot', 'multi_vendor', 'Capture HTTP/HTTPS', 'https_api', 'design_only', 'Capture image uniquement si endpoint officiel documenté et sécurisé.'),
  ('generic.nvr_onvif', 'multi_vendor', 'NVR/DVR via ONVIF', 'nvr_channel', 'design_only', 'Connexion au recorder et déclaration de ses canaux caméra.'),
  ('bridge.analog_encoder', 'multi_vendor', 'Encodeur vidéo analogique', 'analog_encoder', 'design_only', 'Caméras analogiques via DVR/encodeur réseau compatible.'),
  ('vendor.hikvision.isapi', 'hikvision', 'Hikvision ISAPI', 'https_api', 'design_only', 'API fabricant, compatibilité exacte à vérifier par gamme et firmware.'),
  ('vendor.dahua.cgi', 'dahua', 'Dahua CGI / SDK', 'https_api', 'design_only', 'API/SDK officiel, compatibilité exacte à vérifier par gamme et firmware.'),
  ('vendor.axis.vapix', 'axis', 'Axis VAPIX', 'https_api', 'design_only', 'API constructeur VAPIX, fonctions selon modèle et licence.'),
  ('vendor.hanwha.sunapi', 'hanwha', 'Hanwha SUNAPI', 'https_api', 'design_only', 'API constructeur SUNAPI, fonctions selon modèle et firmware.'),
  ('vendor.uniview.lapi', 'uniview', 'Uniview LAPI', 'https_api', 'design_only', 'API constructeur, fonctions selon gamme et firmware.'),
  ('vendor.vivotek.api', 'vivotek', 'Vivotek API', 'https_api', 'design_only', 'API constructeur, fonctions selon modèle et firmware.'),
  ('vendor.flir.isom', 'flir', 'FLIR ISOM', 'vendor_sdk', 'design_only', 'Intégration SDK lorsque le modèle expose cette interface.'),
  ('vendor.milesight.api', 'milesight', 'Milesight API', 'https_api', 'design_only', 'API constructeur, fonctions selon modèle et firmware.'),
  ('vendor.generic.cloud_api', 'multi_vendor', 'API Cloud constructeur', 'cloud_api', 'design_only', 'Uniquement API officielle documentée et autorisée par le fabricant.')
on conflict (adapter_key) do update
set display_name = excluded.display_name,
    manufacturer_key = excluded.manufacturer_key,
    protocol = excluded.protocol,
    notes = excluded.notes,
    updated_at = now();

create table if not exists public.naxa_security_camera_connections (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  camera_id uuid not null,
  gateway_id uuid not null,
  adapter_key text not null references public.naxa_security_camera_adapters(adapter_key) on delete restrict,
  protocol text not null
    check (protocol in ('onvif','rtsp','rtsps','http_api','https_api','vendor_sdk','nvr_channel','analog_encoder','cloud_api')),
  endpoint_host text,
  endpoint_port integer check (endpoint_port is null or endpoint_port between 1 and 65535),
  endpoint_path text,
  channel_identifier text,
  auth_mode text not null default 'none'
    check (auth_mode in ('none','digest','basic_tls','ws_security','bearer_token','vendor_token','mutual_tls','vault_secret')),
  auth_secret_reference text,
  tls_verify boolean not null default true,
  connection_status text not null default 'draft'
    check (connection_status in ('draft','discovered','requires_credentials','testing','connected','limited','unsupported','failed','disabled')),
  discovered_capabilities text[] not null default '{}'::text[]
    check (discovered_capabilities <@ array[
      'live_view','playback','recording','ptz','events','analytics',
      'motion','tamper','audio','two_way_audio','snapshot','health','io_control'
    ]::text[]),
  connection_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(connection_metadata) = 'object'),
  last_tested_at timestamptz,
  last_error_code text,
  is_primary boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint naxa_security_camera_connection_camera_fk
    foreign key (camera_id, pharmacie_id)
    references public.naxa_security_cameras(id, pharmacie_id) on delete restrict,
  constraint naxa_security_camera_connection_gateway_fk
    foreign key (gateway_id, pharmacie_id)
    references public.naxa_security_gateways(id, pharmacie_id) on delete restrict,
  constraint naxa_security_camera_connection_host_ck
    check (
      endpoint_host is null
      or (
        length(endpoint_host) between 1 and 253
        and endpoint_host !~* '^[a-z][a-z0-9+.-]*://'
        and endpoint_host !~ '@'
      )
    ),
  constraint naxa_security_camera_connection_path_ck
    check (endpoint_path is null or (length(endpoint_path) <= 1024 and endpoint_path !~ '://')),
  constraint naxa_security_camera_connection_connected_ck
    check (connection_status <> 'connected' or last_tested_at is not null),
  constraint naxa_security_camera_connection_credentials_ck
    check (auth_secret_reference is null or length(auth_secret_reference) between 1 and 512),
  constraint naxa_security_camera_connection_no_direct_secret_ck
    check (auth_secret_reference is null or auth_secret_reference !~* '(password|passwd)='),
  constraint naxa_security_camera_connection_id_pharmacie_uk unique (id, pharmacie_id)
);

create unique index if not exists naxa_security_camera_one_primary_connection_idx
  on public.naxa_security_camera_connections (camera_id)
  where is_primary = true;

create index if not exists naxa_security_camera_connections_pharmacie_idx
  on public.naxa_security_camera_connections (pharmacie_id, connection_status);

create index if not exists naxa_security_camera_connections_camera_idx
  on public.naxa_security_camera_connections (camera_id, is_primary);

alter table public.naxa_security_camera_adapters enable row level security;
alter table public.naxa_security_camera_adapters force row level security;
alter table public.naxa_security_camera_connections enable row level security;
alter table public.naxa_security_camera_connections force row level security;

revoke all on public.naxa_security_camera_adapters,
  public.naxa_security_camera_connections
from public, anon, authenticated;

grant all on public.naxa_security_camera_adapters,
  public.naxa_security_camera_connections
to service_role;

comment on table public.naxa_security_camera_adapters is
  'Catalogue d’adaptateurs multi-marques. Un statut validated exige des tests documentés sur modèle et firmware précis.';
comment on table public.naxa_security_camera_connections is
  'Connexions caméra via passerelle locale. Les secrets d’authentification sont référencés hors base, jamais stockés en clair.';
