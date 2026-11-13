begin;

create table if not exists public.naxa_partner_payment_devices (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  installation_id text not null check (length(installation_id) between 16 and 128),
  device_name text not null check (length(trim(device_name)) between 2 and 100),
  device_token_hash text not null unique check (device_token_hash ~ '^[0-9a-f]{64}$'),
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, user_id, installation_id)
);

create table if not exists public.naxa_partner_payment_notification_candidates (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null references public.naxa_partner_payment_devices(id) on delete restrict,
  canal text not null check (canal in ('orange_money','mtn_momo')),
  source_type text not null check (source_type in ('notification_listener_candidate','voluntary_sms_share')),
  sender_title text,
  source_package text,
  transaction_direction text not null check (transaction_direction in ('payer_debit','merchant_credit','informative_only')),
  amount integer check (amount is null or amount > 0),
  transaction_reference text,
  payer_number text,
  merchant_number text,
  provider_occurred_at timestamptz,
  received_at timestamptz not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'manual_review' check (status = 'manual_review'),
  created_at timestamptz not null default now(),
  unique (partner_id, payload_sha256)
);

create index if not exists naxa_partner_payment_candidates_review_idx
  on public.naxa_partner_payment_notification_candidates(status, created_at desc);
create index if not exists naxa_partner_payment_devices_user_idx
  on public.naxa_partner_payment_devices(user_id, is_active);

alter table public.naxa_partner_payment_devices enable row level security;
alter table public.naxa_partner_payment_notification_candidates enable row level security;

revoke all on public.naxa_partner_payment_devices from public, anon, authenticated;
revoke all on public.naxa_partner_payment_notification_candidates from public, anon, authenticated;
grant all on public.naxa_partner_payment_devices to service_role;
grant all on public.naxa_partner_payment_notification_candidates to service_role;

comment on table public.naxa_partner_payment_notification_candidates is
  'Candidate payment data from notification listener or voluntary SMS share. Notification title is not authenticated origin; records are always manual review and are not linked to or used to activate a partner subscription.';

commit;
