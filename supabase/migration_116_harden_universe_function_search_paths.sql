-- NAXA 116 — durcir search_path des fonctions SECURITY DEFINER du chantier univers.
-- pg_temp est explicite et placé en dernier pour empêcher l'ombrage des objets public.
begin;

alter function public.get_partner_catalogue_alerts()
  set search_path = public, pg_temp;
alter function public.expire_universe_reservations_cron(integer)
  set search_path = public, pg_temp;

alter function public.get_home_service_catalog()
  set search_path = public, pg_temp;
alter function public.request_home_service(uuid,text,text,text,timestamptz,text)
  set search_path = public, pg_temp;
alter function public.get_home_service_request_receipt(uuid)
  set search_path = public, pg_temp;
alter function public.transition_home_service_request(uuid,text)
  set search_path = public, pg_temp;
alter function public.admin_set_home_service_offer_status(uuid,text)
  set search_path = public, pg_temp;
alter function public.notify_home_service_request_created()
  set search_path = public, pg_temp;
alter function public.notify_home_service_request_status()
  set search_path = public, pg_temp;
alter function public.mark_user_notification_read(uuid)
  set search_path = public, pg_temp;

commit;
