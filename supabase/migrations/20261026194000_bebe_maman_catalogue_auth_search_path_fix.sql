begin;

-- Preserve auth.uid() resolution while keeping the search path restricted.
-- Public application objects are explicitly schema-qualified in these functions.
alter function public.get_universe_catalog(text) set search_path = '';
alter function public.reserve_universe_products(uuid,text,jsonb,text) set search_path = 'auth';
alter function public.get_universe_reservation_receipt(uuid) set search_path = 'auth';

commit;
