begin;

-- Harden the three catalogue/reservation SECURITY DEFINER functions introduced
-- by the Baby & Maman catalogue migration. Their application objects are schema-qualified.
alter function public.get_universe_catalog(text) set search_path = '';
alter function public.reserve_universe_products(uuid,text,jsonb,text) set search_path = '';
alter function public.get_universe_reservation_receipt(uuid) set search_path = '';

commit;
