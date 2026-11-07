-- Existing manual submission RPC already accepts a nullable proof path.
-- Keep the actual column constraint aligned with that supported flow.
alter table public.abonnement_promoteur_reglements
  alter column preuve_path drop not null;

-- Promoteur mobile-money capture: device enrollment, pre-payment intent and candidate events.
-- A notification is only a candidate signal; it can never confirm or reactivate an abonnement.

create table if not exists public.naxa_promoteur_payment_devices (
  id uuid primary key default gen_random_uuid(),
  promoteur_id uuid not null references public.profiles(id) on delete cascade,
  installation_id text not null check (length(installation_id) between 16 and 128),
  device_name text not null check (length(trim(device_name)) between 2 and 100),
  platform text not null default 'android' check (platform = 'android'),
  device_token_hash text not null unique check (device_token_hash ~ '^[0-9a-f]{64}$'),
  is_active boolean not null default true,
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (promoteur_id, installation_id)
);

create table if not exists public.naxa_promoteur_payment_intents (
  id uuid primary key default gen_random_uuid(),
  promoteur_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null references public.naxa_promoteur_payment_devices(id) on delete restrict,
  canal text not null check (canal in ('orange_money','mtn_momo')),
  expected_amount integer not null check (expected_amount > 0),
  currency text not null default 'FCFA' check (currency = 'FCFA'),
  destination_snapshot jsonb not null,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment','capture_received','manual_review','submission_created','expired','cancelled')),
  linked_reglement_id uuid references public.abonnement_promoteur_reglements(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create unique index if not exists naxa_promoteur_payment_intents_one_open_per_promoter
  on public.naxa_promoteur_payment_intents(promoteur_id)
  where status = 'awaiting_payment';

create index if not exists naxa_promoteur_payment_intents_status_expiry_idx
  on public.naxa_promoteur_payment_intents(status, expires_at);

create table if not exists public.naxa_promoteur_payment_capture_events (
  id uuid primary key default gen_random_uuid(),
  promoteur_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null references public.naxa_promoteur_payment_devices(id) on delete restrict,
  intent_id uuid references public.naxa_promoteur_payment_intents(id) on delete set null,
  canal text not null check (canal in ('orange_money','mtn_momo')),
  transaction_reference text not null check (length(trim(transaction_reference)) between 3 and 160),
  amount integer not null check (amount > 0),
  currency text not null check (currency = 'FCFA'),
  recipient_reference text,
  sender_account_masked text,
  provider_occurred_at timestamptz not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  match_status text not null check (match_status in ('matched','mismatch','submitted')),
  created_at timestamptz not null default now(),
  unique (canal, transaction_reference)
);

alter table public.naxa_promoteur_payment_devices enable row level security;
alter table public.naxa_promoteur_payment_intents enable row level security;
alter table public.naxa_promoteur_payment_capture_events enable row level security;

revoke all on public.naxa_promoteur_payment_devices from public, anon, authenticated;
revoke all on public.naxa_promoteur_payment_intents from public, anon, authenticated;
revoke all on public.naxa_promoteur_payment_capture_events from public, anon, authenticated;
grant all on public.naxa_promoteur_payment_devices to service_role;
grant all on public.naxa_promoteur_payment_intents to service_role;
grant all on public.naxa_promoteur_payment_capture_events to service_role;

comment on table public.naxa_promoteur_payment_devices is
  'Android companion devices enrolled by a Promoteur account. Only token hashes are stored; no device can confirm a payment.';
comment on table public.naxa_promoteur_payment_intents is
  'Short-lived payment intents created before the Promoteur pays, bound to one enrolled Android device and a destination snapshot.';
comment on table public.naxa_promoteur_payment_capture_events is
  'Normalized Android notification candidates. Not proof of settlement; never changes subscription status or reactivates a pharmacy.';
