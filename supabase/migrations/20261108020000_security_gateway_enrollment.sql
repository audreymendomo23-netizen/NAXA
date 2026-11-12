-- NAXA — enrôlement et authentification des passerelles locales de sécurité.
-- Phase 3 : code de jumelage unique, clé Ed25519 et heartbeat sortant signé.
-- Aucun port entrant, flux vidéo ou driver caméra n'est activé par cette migration.

alter table public.naxa_security_gateways
  add column if not exists agent_key_fingerprint text
    check (agent_key_fingerprint is null or (length(agent_key_fingerprint) = 64 and agent_key_fingerprint !~ '[^0-9a-f]')),
  add column if not exists agent_version text
    check (agent_version is null or length(agent_version) <= 40);

create table if not exists public.naxa_security_gateway_enrollments (
  id uuid primary key default gen_random_uuid(),
  gateway_id uuid not null,
  pharmacie_id uuid not null,
  token_hash text not null unique check (length(token_hash) = 64 and token_hash !~ '[^0-9a-f]'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  public_key_pem text,
  public_key_fingerprint text,
  revoked_at timestamptz,
  constraint naxa_security_gateway_enrollment_gateway_fk
    foreign key (gateway_id, pharmacie_id)
    references public.naxa_security_gateways(id, pharmacie_id) on delete restrict,
  constraint naxa_security_gateway_enrollment_expiry_ck
    check (expires_at > created_at and expires_at <= created_at + interval '30 minutes'),
  constraint naxa_security_gateway_enrollment_key_pair_ck
    check (
      (consumed_at is null and public_key_pem is null and public_key_fingerprint is null)
      or
      (consumed_at is not null and public_key_pem is not null
       and public_key_fingerprint is not null
       and length(public_key_fingerprint) = 64 and public_key_fingerprint !~ '[^0-9a-f]')
    ),
  constraint naxa_security_gateway_enrollment_key_length_ck
    check (public_key_pem is null or length(public_key_pem) between 80 and 2048)
);

create unique index if not exists naxa_security_gateway_one_pending_enrollment_idx
  on public.naxa_security_gateway_enrollments (gateway_id)
  where consumed_at is null and revoked_at is null;

create index if not exists naxa_security_gateway_active_key_lookup_idx
  on public.naxa_security_gateway_enrollments (gateway_id, public_key_fingerprint, consumed_at desc)
  where consumed_at is not null and revoked_at is null;

create index if not exists naxa_security_gateway_enrollments_lookup_idx
  on public.naxa_security_gateway_enrollments (gateway_id, consumed_at desc);

create table if not exists public.naxa_security_gateway_request_nonces (
  gateway_id uuid not null references public.naxa_security_gateways(id) on delete cascade,
  nonce text not null check (length(nonce) between 32 and 128 and nonce !~ '[^-A-Za-z0-9_]'),
  signed_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (gateway_id, nonce),
  constraint naxa_security_gateway_nonce_expiry_ck
    check (expires_at > signed_at and expires_at <= signed_at + interval '10 minutes')
);

create index if not exists naxa_security_gateway_nonces_expiry_idx
  on public.naxa_security_gateway_request_nonces (gateway_id, expires_at);

do $naxa_security_gateway_enrollment$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.naxa_security_camera_connections'::regclass
      and conname = 'naxa_security_camera_connection_path_no_credentials_ck'
  ) then
    alter table public.naxa_security_camera_connections
      add constraint naxa_security_camera_connection_path_no_credentials_ck
      check (
        endpoint_path is null
        or endpoint_path !~* '[?&](password|passwd|token|secret|api_key|access_token|authorization)='
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.naxa_security_camera_connections'::regclass
      and conname = 'naxa_security_camera_connection_vault_reference_ck'
  ) then
    alter table public.naxa_security_camera_connections
      add constraint naxa_security_camera_connection_vault_reference_ck
      check (
        auth_secret_reference is null
        or (
          auth_mode <> 'none'
          and length(auth_secret_reference) between 10 and 264
          and auth_secret_reference like 'vault://%'
          and substring(auth_secret_reference from 9) ~ '^[A-Za-z0-9]'
          and substring(auth_secret_reference from 9) !~ '[^-A-Za-z0-9/_]'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.naxa_security_camera_connections'::regclass
      and conname = 'naxa_security_camera_connection_metadata_no_secrets_ck'
  ) then
    alter table public.naxa_security_camera_connections
      add constraint naxa_security_camera_connection_metadata_no_secrets_ck
      check (
        connection_metadata::text !~* '"[^"]*(password|passwd|secret|token|authorization|api_key)[^"]*"[[:space:]]*:'
      );
  end if;
end
$naxa_security_gateway_enrollment$;

alter table public.naxa_security_gateway_enrollments enable row level security;
alter table public.naxa_security_gateway_enrollments force row level security;
alter table public.naxa_security_gateway_request_nonces enable row level security;
alter table public.naxa_security_gateway_request_nonces force row level security;

revoke all on public.naxa_security_gateway_enrollments,
  public.naxa_security_gateway_request_nonces
from public, anon, authenticated;

grant all on public.naxa_security_gateway_enrollments,
  public.naxa_security_gateway_request_nonces
to service_role;

comment on table public.naxa_security_gateway_enrollments is
  'Codes de jumelage à usage unique (hash uniquement), clés publiques Ed25519 et révocation des identités de passerelle.';
comment on table public.naxa_security_gateway_request_nonces is
  'Anti-rejeu des requêtes signées des passerelles ; les nonces expirent après quelques minutes.';
comment on column public.naxa_security_gateways.agent_key_fingerprint is
  'Empreinte SHA-256 de la clé publique Ed25519 enrôlée ; aucune clé privée n’est stockée dans NAXA.';
comment on column public.naxa_security_gateways.agent_version is
  'Version de l’agent de passerelle déclarée lors du heartbeat signé.';
