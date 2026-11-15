-- Use the canonical Supabase auth.role() helper for the service-only expiry dispatcher.
-- Some PostgREST requests set request.jwt.claims without populating the legacy
-- request.jwt.claim.role GUC; the authorization boundary remains service_role only.
begin;

create or replace function public.naxa_dispatch_pharmacy_lot_expiry_alerts_internal(
  p_today date,
  p_limit integer default 1000
)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise insufficient_privilege using message='Réservé au service NAXA';
  end if;
  if p_today is null or p_limit is null or p_limit<1 or p_limit>5000 then
    raise exception 'Paramètres de distribution péremption invalides';
  end if;
  return private.dispatch_pharmacy_lot_expiry_alerts(p_today,p_limit);
end
$function$;

revoke all on function public.naxa_dispatch_pharmacy_lot_expiry_alerts_internal(date,integer)
  from public,anon,authenticated;
grant execute on function public.naxa_dispatch_pharmacy_lot_expiry_alerts_internal(date,integer)
  to service_role;

commit;
