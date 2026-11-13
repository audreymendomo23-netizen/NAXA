-- Révoque l'ancienne surcharge GPS qui ne recevait pas l'identité client du serveur.
drop function if exists public.request_home_service_with_location(uuid,text,text,text,timestamptz,text,double precision,double precision,double precision);
