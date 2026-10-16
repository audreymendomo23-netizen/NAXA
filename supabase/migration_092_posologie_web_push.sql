-- NAXA — Rappels de posologie et abonnements Web Push
-- Migration additive, sécurisée par utilisateur. À appliquer via le protocole de migration NAXA.

create table if not exists public.naxa_posologie_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medicament text not null check (char_length(trim(medicament)) between 1 and 100),
  dose text not null check (char_length(trim(dose)) between 1 and 40),
  unite text not null check (char_length(trim(unite)) between 1 and 40),
  heures text[] not null default '{}',
  rappels boolean not null default true,
  timezone text not null default 'Africa/Douala',
  last_notified_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint naxa_posologie_heures_max check (cardinality(heures) <= 8)
);

create index if not exists naxa_posologie_schedules_user_idx
  on public.naxa_posologie_schedules(user_id);
create index if not exists naxa_posologie_schedules_rappels_idx
  on public.naxa_posologie_schedules(rappels) where rappels = true;

create table if not exists public.naxa_push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint naxa_push_subscription_endpoint_nonempty check (length(trim(endpoint)) > 0),
  constraint naxa_push_subscription_shape check (
    jsonb_typeof(subscription) = 'object'
    and subscription ? 'endpoint'
    and subscription ? 'keys'
  )
);

create index if not exists naxa_push_subscriptions_user_idx
  on public.naxa_push_subscriptions(user_id);

alter table public.naxa_posologie_schedules enable row level security;
alter table public.naxa_push_subscriptions enable row level security;

drop policy if exists "Users manage own posology schedules" on public.naxa_posologie_schedules;
create policy "Users manage own posology schedules"
  on public.naxa_posologie_schedules
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own push subscriptions" on public.naxa_push_subscriptions;
create policy "Users manage own push subscriptions"
  on public.naxa_push_subscriptions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.naxa_posologie_schedules from anon;
revoke all on public.naxa_push_subscriptions from anon;
grant select, insert, update, delete on public.naxa_posologie_schedules to authenticated;
grant select, insert, update, delete on public.naxa_push_subscriptions to authenticated;
grant all on public.naxa_posologie_schedules to service_role;
grant all on public.naxa_push_subscriptions to service_role;
