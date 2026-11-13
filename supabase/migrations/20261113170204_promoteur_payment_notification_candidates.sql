begin;

create table if not exists public.naxa_promoteur_payment_notification_candidates (
  id uuid primary key default gen_random_uuid(),
  promoteur_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null references public.naxa_promoteur_payment_devices(id) on delete restrict,
  intent_id uuid not null references public.naxa_promoteur_payment_intents(id) on delete restrict,
  canal text not null check (canal in ('orange_money','mtn_momo')),
  sender_title text not null check (sender_title in ('OrangeMoney','MobileMoney')),
  source_package text not null check (length(source_package) between 1 and 180),
  amount integer not null check (amount > 0),
  transaction_reference text not null check (length(transaction_reference) between 5 and 160),
  payer_number text,
  merchant_number text,
  provider_occurred_at timestamptz,
  received_at timestamptz not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'manual_review' check (status = 'manual_review'),
  created_at timestamptz not null default now(),
  unique (promoteur_id, payload_sha256)
);

create index if not exists naxa_promoteur_payment_notification_review_idx
  on public.naxa_promoteur_payment_notification_candidates(status, created_at desc);
create index if not exists naxa_promoteur_payment_notification_intent_idx
  on public.naxa_promoteur_payment_notification_candidates(intent_id, created_at desc);

alter table public.naxa_promoteur_payment_notification_candidates enable row level security;
revoke all on public.naxa_promoteur_payment_notification_candidates from public, anon, authenticated;
grant all on public.naxa_promoteur_payment_notification_candidates to service_role;

comment on table public.naxa_promoteur_payment_notification_candidates is
  'Android notification-derived payment candidates. Notification sender title is untrusted metadata, never payer_sms level-1 proof and never closes the active payment intent or confirms a subscription.';

commit;
