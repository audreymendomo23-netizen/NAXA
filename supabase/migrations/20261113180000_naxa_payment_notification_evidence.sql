begin;
create table if not exists public.naxa_payment_notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workspace_type text not null check (workspace_type in ('pharmacie','partner','admin')),
  workspace_id uuid not null,
  installation_id text not null check (installation_id ~ '^[0-9a-fA-F-]{36}$'),
  device_name text not null check (length(trim(device_name)) between 2 and 100),
  device_token_hash text not null check (length(device_token_hash)=64),
  notification_consent_at timestamptz,
  is_active boolean not null default true,
  paired_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, installation_id, workspace_type, workspace_id)
);
create index if not exists naxa_payment_notification_devices_owner_idx
  on public.naxa_payment_notification_devices(workspace_type, workspace_id, is_active);
create table if not exists public.naxa_payment_evidence_intake (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.naxa_payment_notification_devices(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  workspace_type text not null check (workspace_type in ('pharmacie','partner','admin')),
  workspace_id uuid not null,
  canal text not null check (canal in ('orange_money','mtn_momo')),
  source_type text not null check (source_type in ('notification','voluntary_sms_share')),
  source_package text,
  direction text not null check (direction in ('payer_debit','merchant_credit','informative_only','unknown')),
  success boolean not null default false,
  amount integer check (amount is null or amount > 0),
  transaction_reference text check (transaction_reference is null or length(transaction_reference) <= 160),
  payer_number_tail text check (payer_number_tail is null or payer_number_tail ~ '^[0-9]{4,9}$'),
  merchant_number_tail text check (merchant_number_tail is null or merchant_number_tail ~ '^[0-9]{4,9}$'),
  merchant_label text check (merchant_label is null or length(merchant_label) <= 160),
  provider_occurred_at timestamptz,
  source_payload_sha256 text not null check (source_payload_sha256 ~ '^[0-9a-f]{64}$'),
  match_status text not null default 'manual_review' check (match_status in ('manual_review','coherent_unconfirmed')),
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint naxa_payment_evidence_source_package_check check (
    (source_type='notification' and source_package is not null)
    or (source_type='voluntary_sms_share' and source_package is null)
  )
);
create unique index if not exists naxa_payment_evidence_device_hash_uidx
  on public.naxa_payment_evidence_intake(device_id, source_payload_sha256);
create index if not exists naxa_payment_evidence_review_idx
  on public.naxa_payment_evidence_intake(workspace_type, workspace_id, match_status, received_at desc);
create index if not exists naxa_payment_evidence_actor_idx
  on public.naxa_payment_evidence_intake(actor_id, received_at desc);
alter table public.naxa_payment_notification_devices enable row level security;
alter table public.naxa_payment_evidence_intake enable row level security;
revoke all on public.naxa_payment_notification_devices from public, anon, authenticated;
revoke all on public.naxa_payment_evidence_intake from public, anon, authenticated;
grant all on public.naxa_payment_notification_devices to service_role;
grant all on public.naxa_payment_evidence_intake to service_role;
comment on table public.naxa_payment_notification_devices is
  'Appareils Android Pharmacy, Partner et Admin ; Client et Promoteur exclus du lecteur de notifications.';
comment on table public.naxa_payment_evidence_intake is
  'Preuves structurées et empreintes uniquement. Aucune conservation du texte SMS/notification brut ; statut initial non confirmé.';
commit;
