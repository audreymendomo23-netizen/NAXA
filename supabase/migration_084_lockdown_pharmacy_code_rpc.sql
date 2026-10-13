-- Verrouillage de sécurité du RPC de validation des codes pharmacie.
-- L'appel anonyme est interdit; seule la fonction Edge utilise service_role.
BEGIN;
REVOKE ALL ON FUNCTION public.naxa_validate_pharmacy_code_v1(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.naxa_validate_pharmacy_code_v1(text, text, text) TO service_role;
COMMIT;
