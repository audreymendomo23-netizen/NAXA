-- NAXA Preview: validation du code pharmacie sans exposer la clé service_role.
-- Le RPC SECURITY DEFINER garde le contrôle du code et le limiteur côté base.
BEGIN;

CREATE OR REPLACE FUNCTION public.naxa_validate_pharmacy_code_v1(
  p_code text,
  p_ip_hash text,
  p_code_hash text
)
RETURNS TABLE(status text, pharmacy_id uuid, pharmacy_name text, retry_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $naxa$
DECLARE
  v_allowed boolean;
  v_retry integer;
  v_pharmacy_id uuid;
  v_pharmacy_name text;
BEGIN
  IF p_code IS NULL OR p_code !~ '^[0-9]{4}$'
     OR p_ip_hash IS NULL OR p_ip_hash !~ '^[a-f0-9]{64}$'
     OR p_code_hash IS NULL OR p_code_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'NAXA pharmacy code: invalid parameters';
  END IF;

  SELECT r.allowed, r.retry_after
    INTO v_allowed, v_retry
    FROM public.naxa_rate_limit_v1('ip_code', p_ip_hash, 'attempt', 5, 600, 30, 900) AS r;
  IF NOT coalesce(v_allowed, false) THEN
    RETURN QUERY SELECT 'rate_limited'::text, NULL::uuid, NULL::text, greatest(1, coalesce(v_retry, 1));
    RETURN;
  END IF;

  SELECT r.allowed, r.retry_after
    INTO v_allowed, v_retry
    FROM public.naxa_rate_limit_v1('code', p_code_hash, 'attempt', 20, 3600, 900, 900) AS r;
  IF NOT coalesce(v_allowed, false) THEN
    RETURN QUERY SELECT 'rate_limited'::text, NULL::uuid, NULL::text, greatest(1, coalesce(v_retry, 1));
    RETURN;
  END IF;

  SELECT p.id, p.nom
    INTO v_pharmacy_id, v_pharmacy_name
    FROM public.pharmacies AS p
   WHERE p.code_pharmacie = p_code
     AND p.actif IS TRUE
   LIMIT 2;

  IF v_pharmacy_id IS NULL OR v_pharmacy_name IS NULL THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::uuid, NULL::text, 0;
    RETURN;
  END IF;

  PERFORM public.naxa_rate_limit_v1('ip_code', p_ip_hash, 'success', 5, 600, 30, 900);
  PERFORM public.naxa_rate_limit_v1('code', p_code_hash, 'success', 20, 3600, 900, 900);

  RETURN QUERY SELECT 'ok'::text, v_pharmacy_id, v_pharmacy_name, 0;
END
$naxa$;

REVOKE ALL ON FUNCTION public.naxa_validate_pharmacy_code_v1(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.naxa_validate_pharmacy_code_v1(text, text, text) TO anon;

COMMIT;
