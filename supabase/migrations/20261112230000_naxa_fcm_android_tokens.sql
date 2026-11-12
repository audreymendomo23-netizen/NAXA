-- NAXA — enregistrement sécurisé des jetons Firebase Cloud Messaging Android.
begin;

create table if not exists public.naxa_fcm_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'android' check (platform = 'android'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint naxa_fcm_token_length check (char_length(token) between 100 and 4096)
);

create index if not exists naxa_fcm_tokens_user_idx on public.naxa_fcm_tokens(user_id);
alter table public.naxa_fcm_tokens enable row level security;
drop policy if exists "Users manage own FCM tokens" on public.naxa_fcm_tokens;
create policy "Users manage own FCM tokens" on public.naxa_fcm_tokens
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.naxa_fcm_tokens from anon;
grant select, insert, update, delete on public.naxa_fcm_tokens to authenticated;
grant all on public.naxa_fcm_tokens to service_role;

commit;
