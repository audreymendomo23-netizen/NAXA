-- NAXA — Security hardening for public catalogue RPCs and scoped helpers.
-- Safe to apply on Production and Replay: both schemas contain the pharmacy
-- visibility flags and the legacy/current stock-lot columns used below.
-- This migration changes no business records and does not relax table RLS.

BEGIN;

-- 1) Private implementation for the public popular-products endpoint.
-- Only real, active, visible and non-archived pharmacies contribute to
-- public availability and minimum-price ranking.
CREATE OR REPLACE FUNCTION private.produits_populaires(
  p_limit integer DEFAULT 10,
  p_jours integer DEFAULT 7
)
RETURNS TABLE(
  produit_id uuid,
  nom text,
  dosage text,
  photo_url text,
  prix_min integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH top AS (
    SELECT
      p.id,
      p.nom,
      p.dosage,
      p.photo_url,
      min(s.prix)::integer AS prix_min,
      count(e.id)::integer AS score
    FROM public.recherche_events e
    JOIN public.produits p ON p.id = e.produit_id
    JOIN public.stocks s ON s.produit_id = p.id AND s.quantite > 0
    JOIN public.pharmacies ph
      ON ph.id = s.pharmacie_id
     AND ph.actif IS TRUE
     AND ph.visible_recherche IS TRUE
     AND ph.est_demo IS FALSE
     AND ph.archivee_le IS NULL
    WHERE e.created_at > now() - make_interval(days => LEAST(GREATEST(COALESCE(p_jours, 7), 1), 365))
    GROUP BY p.id
  ),
  comp AS (
    SELECT
      p.id,
      p.nom,
      p.dosage,
      p.photo_url,
      min(s.prix)::integer AS prix_min,
      count(DISTINCT s.pharmacie_id)::integer AS score
    FROM public.produits p
    JOIN public.stocks s ON s.produit_id = p.id AND s.quantite > 0
    JOIN public.pharmacies ph
      ON ph.id = s.pharmacie_id
     AND ph.actif IS TRUE
     AND ph.visible_recherche IS TRUE
     AND ph.est_demo IS FALSE
     AND ph.archivee_le IS NULL
    WHERE NOT EXISTS (SELECT 1 FROM top t WHERE t.id = p.id)
    GROUP BY p.id
  )
  SELECT id, nom, dosage, photo_url, prix_min
  FROM (
    SELECT *, 1 AS rang FROM top
    UNION ALL
    SELECT *, 2 AS rang FROM comp
  ) x
  ORDER BY rang, score DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 10), 1), 20);
$function$;

REVOKE ALL ON FUNCTION private.produits_populaires(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.produits_populaires(integer, integer) TO anon, authenticated, service_role;

-- Public API wrapper is invoker-only; the private, filtered implementation
-- performs the narrowly-scoped SECURITY DEFINER read.
CREATE OR REPLACE FUNCTION public.produits_populaires(
  p_limit integer DEFAULT 10,
  p_jours integer DEFAULT 7
)
RETURNS TABLE(
  produit_id uuid,
  nom text,
  dosage text,
  photo_url text,
  prix_min integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT *
  FROM private.produits_populaires(
    LEAST(GREATEST(COALESCE(p_limit, 10), 1), 20),
    LEAST(GREATEST(COALESCE(p_jours, 7), 1), 365)
  );
$function$;

-- 2) Portable private cart-search implementation. The public wrapper is
-- invoker-only; the SECURITY DEFINER implementation never returns a hidden,
-- demo, inactive or archived pharmacy.
CREATE OR REPLACE FUNCTION private.search_pharmacies_panier(
  p_items jsonb,
  p_lat double precision,
  p_lng double precision,
  p_rayon_km double precision DEFAULT 20
)
RETURNS TABLE(
  pharmacie_id uuid,
  nom text,
  quartier text,
  adresse text,
  lat double precision,
  lng double precision,
  de_garde boolean,
  stock_updated_at timestamp with time zone,
  distance_km double precision,
  total_prix integer,
  items jsonb,
  trouves integer,
  demandes integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH req AS (
    SELECT
      (x->>'produit_id')::uuid AS produit_id,
      GREATEST(1, LEAST(10, COALESCE((x->>'quantite')::integer, 1))) AS qte
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(p_items) = 'array' THEN p_items ELSE '[]'::jsonb END
    ) x
  ),
  nb AS (
    SELECT count(*)::integer AS c FROM req
  ),
  ok AS (
    SELECT
      s.pharmacie_id,
      s.produit_id,
      p.nom,
      p.dosage,
      s.prix,
      s.quantite,
      r.qte
    FROM req r
    JOIN public.stocks s
      ON s.produit_id = r.produit_id
     AND s.quantite >= r.qte
     AND (s.date_peremption IS NULL OR s.date_peremption >= current_date)
    JOIN public.pharmacies ph
      ON ph.id = s.pharmacie_id
     AND ph.actif IS TRUE
     AND ph.visible_recherche IS TRUE
     AND ph.est_demo IS FALSE
     AND ph.archivee_le IS NULL
    JOIN public.produits p ON p.id = s.produit_id
  ),
  agg AS (
    SELECT
      pharmacie_id,
      count(*)::integer AS trouves,
      sum(prix * qte)::integer AS total,
      jsonb_agg(
        jsonb_build_object(
          'produit_id', produit_id,
          'nom', nom,
          'dosage', dosage,
          'prix', prix,
          'quantite', quantite,
          'quantite_demandee', qte
        ) ORDER BY nom
      ) AS items
    FROM ok
    GROUP BY pharmacie_id
  )
  SELECT
    ph.id,
    ph.nom,
    ph.quartier,
    ph.adresse,
    ph.lat,
    ph.lng,
    ph.de_garde,
    ph.stock_updated_at,
    d.km,
    a.total,
    a.items,
    a.trouves,
    nb.c
  FROM agg a
  JOIN public.pharmacies ph
    ON ph.id = a.pharmacie_id
   AND ph.actif IS TRUE
   AND ph.visible_recherche IS TRUE
   AND ph.est_demo IS FALSE
   AND ph.archivee_le IS NULL
  CROSS JOIN nb
  CROSS JOIN LATERAL (
    SELECT 6371 * 2 * asin(sqrt(
      power(sin(radians(ph.lat - p_lat) / 2), 2)
      + cos(radians(p_lat)) * cos(radians(ph.lat))
      * power(sin(radians(ph.lng - p_lng) / 2), 2)
    )) AS km
  ) d
  WHERE p_lat BETWEEN -90 AND 90
    AND p_lng BETWEEN -180 AND 180
    AND d.km <= LEAST(GREATEST(COALESCE(p_rayon_km, 20), 1), 100)
  ORDER BY (a.trouves = nb.c) DESC, d.km;
$function$;

REVOKE ALL ON FUNCTION private.search_pharmacies_panier(jsonb, double precision, double precision, double precision) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.search_pharmacies_panier(jsonb, double precision, double precision, double precision) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.search_pharmacies_panier(
  p_items jsonb,
  p_lat double precision,
  p_lng double precision,
  p_rayon_km double precision DEFAULT 20
)
RETURNS TABLE(
  pharmacie_id uuid,
  nom text,
  quartier text,
  adresse text,
  lat double precision,
  lng double precision,
  de_garde boolean,
  stock_updated_at timestamp with time zone,
  distance_km double precision,
  total_prix integer,
  items jsonb,
  trouves integer,
  demandes integer
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT *
  FROM private.search_pharmacies_panier($1, $2, $3, $4);
$function$;

-- 3) The public stock-offer RPC is intentionally callable without login,
-- but only for pharmacies eligible for public search. Keep lot blocking and
-- both current/legacy expiry columns compatible across NAXA environments.
CREATE OR REPLACE FUNCTION public.marketplace_offre_stock_disponible(
  p_pharmacie uuid,
  p_produit uuid
)
RETURNS TABLE(prix integer, quantite integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_stock public.stocks%rowtype;
  v_has_lots boolean;
  v_sellable integer;
  v_reserved integer;
BEGIN
  IF p_pharmacie IS NULL OR p_produit IS NULL THEN
    RETURN;
  END IF;

  SELECT s.*
  INTO v_stock
  FROM public.stocks s
  JOIN public.pharmacies ph ON ph.id = s.pharmacie_id
  WHERE s.pharmacie_id = p_pharmacie
    AND s.produit_id = p_produit
    AND ph.actif IS TRUE
    AND ph.visible_recherche IS TRUE
    AND ph.est_demo IS FALSE
    AND ph.archivee_le IS NULL;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(sum(ri.quantite), 0)::integer
  INTO v_reserved
  FROM public.reservation_items ri
  JOIN public.reservations r ON r.id = ri.reservation_id
  WHERE r.pharmacie_id = p_pharmacie
    AND ri.produit_id = p_produit
    AND r.statut IN ('en_attente', 'confirmee')
    AND r.expires_at > now()
    AND r.consumed_at IS NULL
    AND COALESCE(r.stock_restored, false) IS FALSE
    AND COALESCE(r.stock_decremented, false) IS FALSE;

  SELECT EXISTS (
    SELECT 1
    FROM public.stocks_lots l
    WHERE l.pharmacie_id = p_pharmacie
      AND l.produit_id = p_produit
  )
  INTO v_has_lots;

  IF v_has_lots THEN
    SELECT COALESCE(sum(l.quantite), 0)::integer
    INTO v_sellable
    FROM public.stocks_lots l
    WHERE l.pharmacie_id = p_pharmacie
      AND l.produit_id = p_produit
      AND COALESCE(l.bloque, false) IS FALSE
      AND (
        COALESCE(l.date_peremption, l.peremption) IS NULL
        OR COALESCE(l.date_peremption, l.peremption) >= current_date
      );
  ELSE
    v_sellable := CASE
      WHEN v_stock.date_peremption IS NULL OR v_stock.date_peremption >= current_date
        THEN GREATEST(COALESCE(v_stock.quantite, 0), 0)
      ELSE 0
    END;
  END IF;

  RETURN QUERY
  SELECT v_stock.prix, GREATEST(COALESCE(v_sellable, 0) - COALESCE(v_reserved, 0), 0);
END;
$function$;

-- 4) The Bebe-Maman catalogue must never expose a pharmacy that is hidden,
-- a demo, or archived through its pharmacy-name join.
CREATE OR REPLACE FUNCTION public.get_universe_catalog(p_universe_slug text)
RETURNS TABLE(
  product_id uuid,
  partner_id uuid,
  partner_name text,
  universe_slug text,
  name text,
  brand text,
  category text,
  description text,
  photo_url text,
  price_fcfa integer,
  available_quantity numeric,
  unit_label text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT
    pp.id,
    pa.id,
    CASE WHEN pp.universe_slug = 'bebe-maman' THEN ph.nom ELSE pa.name END,
    pp.universe_slug,
    pp.name,
    pp.brand,
    pp.category,
    pp.description,
    pp.photo_url,
    pp.price_fcfa,
    GREATEST(0, pp.stock_quantity - COALESCE(reserved.quantity_reserved, 0)),
    pp.unit_label
  FROM public.partner_products pp
  JOIN public.partners pa
    ON pa.id = pp.partner_id
   AND pa.status = 'active'
  JOIN public.partner_universes pu
    ON pu.partner_id = pa.id
   AND pu.universe_slug = pp.universe_slug
   AND pu.enabled = TRUE
  JOIN public.universes u
    ON u.slug = pp.universe_slug
   AND u.enabled = TRUE
  JOIN public.feature_flags ff
    ON ff.flag_key = 'universe.' || pp.universe_slug
   AND ff.enabled = TRUE
  LEFT JOIN LATERAL (
    SELECT sum(ri.quantity)::numeric AS quantity_reserved
    FROM public.universe_reservation_items ri
    JOIN public.universe_reservations r ON r.id = ri.reservation_id
    WHERE ri.product_id = pp.id
      AND r.status IN ('requested', 'confirmed', 'ready')
      AND r.expires_at > now()
  ) reserved ON TRUE
  LEFT JOIN public.pharmacies ph
    ON pp.universe_slug = 'bebe-maman'
   AND ph.id = pp.pharmacie_id
   AND ph.actif IS TRUE
   AND ph.visible_recherche IS TRUE
   AND ph.est_demo IS FALSE
   AND ph.archivee_le IS NULL
  LEFT JOIN public.pharmacie_services ps
    ON ps.pharmacie_id = ph.id
   AND ps.service_slug = 'bebe-maman'
   AND ps.status = 'active'
  WHERE pp.universe_slug = p_universe_slug
    AND p_universe_slug IN ('parapharmacie', 'bebe-maman')
    AND pp.status = 'active'
    AND (pp.expires_at IS NULL OR pp.expires_at >= current_date)
    AND pp.stock_quantity - COALESCE(reserved.quantity_reserved, 0) > 0
    AND (pp.universe_slug <> 'bebe-maman' OR (ph.id IS NOT NULL AND ps.pharmacie_id IS NOT NULL))
  ORDER BY pp.category, pp.name, pa.name;
$function$;

-- 5) The generic scope RPC answers only for the caller's own profile (or
-- an administrator/service role). Internal cross-profile checks use the
-- private helper and are not exposed as an enumeration endpoint.
CREATE OR REPLACE FUNCTION public.naxa_scope_allows(
  p_profile uuid,
  p_pharmacie uuid,
  p_scope text DEFAULT 'PHARMACIE'::text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN p_profile IS NULL THEN FALSE
    WHEN p_profile = (SELECT auth.uid())
      OR (SELECT auth.role()) = 'service_role'
      OR public.is_admin()
      THEN private.naxa_scope_allows(p_profile, p_pharmacie, p_scope)
    ELSE FALSE
  END;
$function$;

-- 6) Verification status is an identity attribute. Keep cross-profile checks
-- inside the private schema for the share policies; the public RPC is
-- self-only (or admin/service role).
CREATE OR REPLACE FUNCTION private.suivi_is_verified_professional(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.suivi_professionals p
    WHERE p.user_id = p_user_id
      AND p.verified IS TRUE
  );
$function$;

REVOKE ALL ON FUNCTION private.suivi_is_verified_professional(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.suivi_is_verified_professional(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.suivi_is_verified_professional(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN p_user_id IS NULL THEN FALSE
    WHEN p_user_id = (SELECT auth.uid())
      OR (SELECT auth.role()) = 'service_role'
      OR public.is_admin()
      THEN private.suivi_is_verified_professional(p_user_id)
    ELSE FALSE
  END;
$function$;

DROP POLICY IF EXISTS suivi_shares_owner_insert ON public.suivi_shares;
CREATE POLICY suivi_shares_owner_insert
ON public.suivi_shares
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (
  owner_user_id = (SELECT auth.uid())
  AND suivi_is_enabled_user((SELECT auth.uid()))
  AND private.suivi_is_verified_professional(recipient_user_id)
  AND suivi_has_consent(owner_user_id, suivi_measurement_family(measurement_type))
  AND EXISTS (
    SELECT 1
    FROM public.suivi_measurements m
    WHERE m.user_id = suivi_shares.owner_user_id
      AND m.measurement_type = suivi_shares.measurement_type
  )
);

DROP POLICY IF EXISTS suivi_shares_owner_update ON public.suivi_shares;
CREATE POLICY suivi_shares_owner_update
ON public.suivi_shares
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (
  owner_user_id = (SELECT auth.uid())
  AND suivi_is_enabled_user((SELECT auth.uid()))
)
WITH CHECK (
  owner_user_id = (SELECT auth.uid())
  AND suivi_is_enabled_user((SELECT auth.uid()))
  AND (
    active = FALSE
    OR (
      private.suivi_is_verified_professional(recipient_user_id)
      AND suivi_has_consent(owner_user_id, suivi_measurement_family(measurement_type))
      AND EXISTS (
        SELECT 1
        FROM public.suivi_measurements m
        WHERE m.user_id = suivi_shares.owner_user_id
          AND m.measurement_type = suivi_shares.measurement_type
      )
    )
  )
);

-- 7) Explicit EXECUTE grants: keep public catalogue RPCs reachable by the
-- intended API roles, but remove the implicit PUBLIC pseudo-role grant.
REVOKE ALL ON FUNCTION public.produits_populaires(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.produits_populaires(integer, integer) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.search_pharmacies_panier(jsonb, double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_pharmacies_panier(jsonb, double precision, double precision, double precision) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.marketplace_offre_stock_disponible(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketplace_offre_stock_disponible(uuid, uuid) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_universe_catalog(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_universe_catalog(text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_home_service_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_home_service_catalog() TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.universe_partner_is_public(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.universe_partner_is_public(uuid, text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.naxa_scope_allows(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.naxa_scope_allows(uuid, uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.suivi_is_verified_professional(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suivi_is_verified_professional(uuid) TO authenticated, service_role;

COMMIT;
