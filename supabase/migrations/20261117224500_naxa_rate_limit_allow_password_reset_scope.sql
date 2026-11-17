-- Keep the Production RPC scope allow-list aligned with the password recovery route.
-- The route calls this RPC with scope ip_password_reset before looking up the account.

create or replace function public.naxa_rate_limit_v1(
  p_scope text,
  p_key_hash text,
  p_action text,
  p_limit integer,
  p_window_seconds integer,
  p_base_block_seconds integer default 30,
  p_max_block_seconds integer default 900
)
returns table(allowed boolean, retry_after integer, failures integer)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  r public.tentatives_code%rowtype;
  v_now timestamptz := clock_timestamp();
  v_block integer;
  v_window interval;
begin
  if p_scope not in ('ip_code','code','ip_login','login_user','ip_password','password_user','ip_password_reset')
    or p_action not in ('check','attempt','fail','success')
    or p_key_hash !~ '^[a-f0-9]{64}$'
    or p_limit < 1
    or p_window_seconds < 1 then
    raise exception 'NAXA rate limit: paramètres invalides';
  end if;

  v_window := make_interval(secs => p_window_seconds);

  insert into public.tentatives_code(scope, key_hash, last_seen_at)
  values (p_scope, p_key_hash, v_now)
  on conflict (scope, key_hash)
  do update set last_seen_at = excluded.last_seen_at;

  select * into r
  from public.tentatives_code t
  where t.scope = p_scope and t.key_hash = p_key_hash
  for update;

  if p_action = 'success' then
    update public.tentatives_code
    set failures = 0, window_started_at = v_now, blocked_until = null, last_seen_at = v_now
    where scope = p_scope and key_hash = p_key_hash;
    return query select true, 0, 0;
    return;
  end if;

  if r.blocked_until is not null and r.blocked_until > v_now then
    return query select false, greatest(1, ceil(extract(epoch from r.blocked_until - v_now))::integer), r.failures;
    return;
  end if;

  if p_action = 'check' then
    return query select true, 0, r.failures;
    return;
  end if;

  if r.window_started_at + v_window <= v_now then
    r.failures := 0;
    r.window_started_at := v_now;
  end if;

  r.failures := r.failures + 1;

  if r.failures > p_limit then
    v_block := least(p_max_block_seconds, greatest(p_base_block_seconds, r.block_seconds));
    update public.tentatives_code
    set failures = 0,
        window_started_at = v_now,
        blocked_until = v_now + make_interval(secs => v_block),
        block_seconds = least(p_max_block_seconds, greatest(p_base_block_seconds, r.block_seconds * 2)),
        last_seen_at = v_now
    where scope = p_scope and key_hash = p_key_hash;
    return query select false, v_block, r.failures;
    return;
  end if;

  update public.tentatives_code
  set failures = r.failures,
      window_started_at = r.window_started_at,
      blocked_until = null,
      last_seen_at = v_now
  where scope = p_scope and key_hash = p_key_hash;

  return query select true, 0, r.failures;
end
$function$;

comment on function public.naxa_rate_limit_v1(text,text,text,integer,integer,integer,integer)
is 'NAXA rate limiter: scopes autorisés incluant ip_password_reset pour la récupération OTP.';
