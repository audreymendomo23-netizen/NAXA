-- NAXA — ACL des vues de projection et retrait des droits anon sur le suivi professionnel.
-- Les vues restent consultables en lecture ; aucune écriture API n'est autorisée.
BEGIN;

REVOKE ALL PRIVILEGES ON TABLE public.suivi_professional_weekly_availability FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON TABLE public.suivi_professionals FROM PUBLIC, anon;

REVOKE ALL PRIVILEGES ON TABLE public.marketplace_assureurs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.marketplace_assureurs TO anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.marketplace_assurance_conventions FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.marketplace_assurance_conventions TO anon, authenticated, service_role;

REVOKE ALL PRIVILEGES ON TABLE public.medicaments_cima_photos_public FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.medicaments_cima_photos_public TO anon, authenticated, service_role;

COMMIT;
