begin;

-- Le dossier peut etre confirme automatiquement uniquement a partir du SMS
-- de credit recu sur un telephone Admin actif, lie a la destination marchande exacte.
alter table public.abonnement_promoteur_reglements
  drop constraint if exists abonnement_promoteur_reglements_verification_status_ck;
alter table public.abonnement_promoteur_reglements
  add constraint abonnement_promoteur_reglements_verification_status_ck
  check (verification_status in (
    'pending',
    'coherent_needs_operator_confirmation',
    'manual_review',
    'invalid',
    'confirmed_admin',
    'auto_confirmed_admin_sms'
  ));

create table if not exists public.naxa_admin_payment_devices (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete restrict,
  installation_id text not null check (installation_id ~ '^[0-9a-fA-F-]{36}$'),
  device_name text not null check (length(trim(device_name)) between 2 and 100),
  canal text not null check (canal in ('orange_money','mtn_momo')),
  merchant_reference text not null check (length(trim(merchant_reference)) between 3 and 160),
  device_token_hash text not null check (length(device_token_hash)=64),
  is_active boolean not null default true,
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint naxa_admin_payment_device_installation_channel_unique
    unique(admin_id,installation_id,canal)
);

create index if not exists naxa_admin_payment_devices_admin_active_idx
  on public.naxa_admin_payment_devices(admin_id,canal)
  where is_active=true;

alter table public.naxa_admin_payment_devices enable row level security;
revoke all on public.naxa_admin_payment_devices from public,anon,authenticated;
grant all on public.naxa_admin_payment_devices to service_role;

create table if not exists public.naxa_admin_payment_capture_events (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id) on delete restrict,
  device_id uuid not null references public.naxa_admin_payment_devices(id) on delete restrict,
  reglement_id uuid references public.abonnement_promoteur_reglements(id) on delete restrict,
  canal text not null check (canal in ('orange_money','mtn_momo')),
  direction text not null check (direction in ('merchant_credit','payer_debit','informative_only')),
  success boolean not null default false,
  transaction_reference text not null check (length(trim(transaction_reference)) between 3 and 160),
  reference_normalisee text generated always as
    (nullif(upper(regexp_replace(coalesce(transaction_reference,''),'[^A-Za-z0-9]','','g')),'')) stored,
  amount integer not null check (amount > 0),
  currency text not null check (currency='FCFA'),
  payer_number text,
  merchant_reference text not null,
  sender_origin_id text not null,
  provider_occurred_at timestamptz,
  sms_received_at timestamptz not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  match_status text not null check (match_status in (
    'waiting_for_pair','matched','manual_review','ambiguous','duplicate','confirmed'
  )),
  created_at timestamptz not null default now()
);

create unique index if not exists naxa_admin_payment_capture_reference_unique
  on public.naxa_admin_payment_capture_events(reference_normalisee)
  where reference_normalisee is not null;

create index if not exists naxa_admin_payment_capture_pending_idx
  on public.naxa_admin_payment_capture_events(reglement_id,match_status,created_at);

alter table public.naxa_admin_payment_capture_events enable row level security;
revoke all on public.naxa_admin_payment_capture_events from public,anon,authenticated;
grant all on public.naxa_admin_payment_capture_events to service_role;

commit;
