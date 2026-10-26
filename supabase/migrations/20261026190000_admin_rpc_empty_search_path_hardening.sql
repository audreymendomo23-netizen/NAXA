begin;

-- Use an empty search_path for every remaining SECURITY DEFINER admin/partner RPC
-- in this hardening set. Function bodies use schema-qualified application objects.
alter function public.admin_set_home_service_offer_status(uuid,text) set search_path = '';
alter function public.admin_set_partner_universe(uuid,text,boolean) set search_path = '';
alter function public.admin_set_universe_enabled(text,boolean) set search_path = '';
alter function public.expire_universe_reservations(integer) set search_path = '';
alter function public.get_home_service_request_receipt(uuid) set search_path = '';
alter function public.is_suivi_test_account(uuid) set search_path = '';
alter function public.partner_adjust_universe_stock(uuid,numeric,text,text) set search_path = '';
alter function public.partner_import_universe_products(uuid,text,jsonb) set search_path = '';

commit;
