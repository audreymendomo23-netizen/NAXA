-- Replay security contract: Marketplace stock visibility and financial view RLS.
begin;

do $test$
declare
  v_options text[];
  v_definition text;
begin
  select c.reloptions into v_options
  from pg_class c
  where c.oid = 'public.v_reservations_ca'::regclass;

  if not coalesce(v_options @> array['security_invoker=true'], false) then
    raise exception 'v_reservations_ca must execute with security_invoker=true';
  end if;

  if has_table_privilege('anon', 'public.v_reservations_ca', 'select') then
    raise exception 'anon must not read v_reservations_ca';
  end if;

  if not has_table_privilege('authenticated', 'public.v_reservations_ca', 'select') then
    raise exception 'authenticated must retain scoped read access to v_reservations_ca';
  end if;

  select pg_get_functiondef(
    'public.marketplace_offre_stock_disponible(uuid,uuid)'::regprocedure
  ) into v_definition;

  if position('ph.est_demo is false' in lower(v_definition)) = 0
     or position('ph.archivee_le is null' in lower(v_definition)) = 0 then
    raise exception 'Marketplace stock RPC must exclude demo and archived pharmacies';
  end if;

  if not has_function_privilege(
    'anon', 'public.marketplace_offre_stock_disponible(uuid,uuid)', 'execute'
  ) then
    raise exception 'anon must retain the intentionally public sellable-stock RPC';
  end if;

  if exists (
    select 1
    from public.stocks s
    join public.pharmacies ph on ph.id = s.pharmacie_id
    cross join lateral public.marketplace_offre_stock_disponible(ph.id, s.produit_id) offer
    where ph.est_demo is true
  ) then
    raise exception 'Marketplace stock RPC returned an offer for a demo pharmacy';
  end if;
end;
$test$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000000',
  true
);

do $test$
declare
  v_rows integer;
begin
  select count(*)::integer into v_rows
  from public.v_reservations_ca;

  if v_rows <> 0 then
    raise exception 'An authenticated user without a client/pharmacy scope can see financial aggregate rows';
  end if;
end;
$test$;

reset role;
rollback;

select '20261105124653 marketplace and financial view security PASS' as resultat;
