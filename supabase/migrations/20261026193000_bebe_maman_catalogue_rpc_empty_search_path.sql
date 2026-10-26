begin;

-- All application tables/functions are schema-qualified. get_universe_catalog
-- needs no non-system search path. Reservation functions call auth.uid()
-- unqualified, so keep only auth on their search path.
alter function public.get_universe_catalog(text) set search_path = '';
alter function public.reserve_universe_products(uuid,text,jsonb,text) set search_path = 'auth';
alter function public.get_universe_reservation_receipt(uuid) set search_path = 'auth';

commit;
