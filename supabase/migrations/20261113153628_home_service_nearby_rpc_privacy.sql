-- Le RPC de proximité ne doit être appelé que par le serveur NAXA.
revoke all on function public.get_home_service_catalog_nearby(double precision,double precision,double precision) from public,anon,authenticated;
grant execute on function public.get_home_service_catalog_nearby(double precision,double precision,double precision) to service_role;
