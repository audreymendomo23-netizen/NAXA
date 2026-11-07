-- NAXA — limite globale partagée pour les fournisseurs de géocodage publics.
begin;

create table if not exists public.naxa_api_rate_limits (
  rate_limit_key text primary key,
  next_allowed_at timestamptz not null,
  updated_at timestamptz not null default now(),
  constraint naxa_api_rate_limits_key_valid check (rate_limit_key ~ '^[a-z0-9_-]{1,80}$')
);

alter table public.naxa_api_rate_limits enable row level security;
revoke all on table public.naxa_api_rate_limits from public, anon, authenticated;
grant all on table public.naxa_api_rate_limits to service_role;

create or replace function public.naxa_reserve_api_rate_limit(
  p_key text,
  p_interval_ms integer default 1000,
  p_max_wait_ms integer default 1500
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_next timestamptz;
  v_slot timestamptz;
begin
  if p_key is null or p_key !~ '^[a-z0-9_-]{1,80}$'
    or p_interval_ms < 250 or p_interval_ms > 60000
    or p_max_wait_ms < 0 or p_max_wait_ms > 10000 then
    raise exception 'invalid_rate_limit_arguments';
  end if;

  insert into public.naxa_api_rate_limits (rate_limit_key, next_allowed_at, updated_at)
  values (p_key, v_now, v_now)
  on conflict (rate_limit_key) do nothing;

  select next_allowed_at
    into v_next
    from public.naxa_api_rate_limits
    where rate_limit_key = p_key
    for update;

  v_slot := greatest(v_next, v_now);
  if v_slot > v_now + make_interval(secs => p_max_wait_ms::double precision / 1000.0) then
    return null;
  end if;

  update public.naxa_api_rate_limits
    set next_allowed_at = v_slot + make_interval(secs => p_interval_ms::double precision / 1000.0),
        updated_at = v_now
    where rate_limit_key = p_key;

  return v_slot;
end;
$$;

revoke all on function public.naxa_reserve_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.naxa_reserve_api_rate_limit(text, integer, integer) to service_role;

comment on function public.naxa_reserve_api_rate_limit(text, integer, integer) is
  'Réserve atomiquement un créneau global partagé pour les appels de géocodage externes; service_role uniquement.';

commit;
