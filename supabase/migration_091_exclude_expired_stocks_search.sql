-- Filtre les stocks expirés dans les recherches client et panier.
-- Migration additive : remplace uniquement les définitions des RPC existantes.
CREATE OR REPLACE FUNCTION public.search_pharmacies(
  p_terms text[],
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
SET search_path TO 'extensions', 'public'
AS $function$
  WITH termes AS (
    SELECT row_number() OVER () n, lower(unaccent(trim(t))) q
    FROM unnest(p_terms) t
    WHERE length(trim(t)) > 1
  ),
  nb AS (
    SELECT count(*)::int c FROM termes
  ),
  cand AS (
    SELECT
      t.n,
      s.pharmacie_id,
      pr.id produit_id,
      pr.nom,
      pr.dosage,
      s.prix,
      s.quantite,
      row_number() OVER (
        PARTITION BY t.n, s.pharmacie_id
        ORDER BY similarity(pr.nom_norm, t.q) DESC, s.prix
      ) rk
    FROM termes t
    JOIN public.produits pr
      ON pr.nom_norm % t.q OR pr.nom_norm ILIKE '%' || t.q || '%'
    JOIN public.stocks s
      ON s.produit_id = pr.id
     AND s.quantite > 0
     AND (s.date_peremption IS NULL OR s.date_peremption >= CURRENT_DATE)
    JOIN public.pharmacies ph
      ON ph.id = s.pharmacie_id
     AND ph.actif
  ),
  best AS (
    SELECT * FROM cand WHERE rk = 1
  ),
  agg AS (
    SELECT
      pharmacie_id,
      count(DISTINCT n)::int trouves,
      sum(prix)::int total,
      jsonb_agg(
        jsonb_build_object(
          'produit_id', produit_id,
          'nom', nom,
          'dosage', dosage,
          'prix', prix,
          'quantite', quantite
        ) ORDER BY n
      ) items
    FROM best
    GROUP BY pharmacie_id
  )
  SELECT
    ph.id, ph.nom, ph.quartier, ph.adresse, ph.lat, ph.lng,
    ph.de_garde, ph.stock_updated_at, d.km,
    a.total, a.items, a.trouves, nb.c
  FROM agg a
  JOIN public.pharmacies ph ON ph.id = a.pharmacie_id AND ph.actif
  CROSS JOIN nb
  CROSS JOIN LATERAL (
    SELECT 6371 * 2 * asin(sqrt(
      power(sin(radians(ph.lat - p_lat) / 2), 2)
      + cos(radians(p_lat)) * cos(radians(ph.lat))
      * power(sin(radians(ph.lng - p_lng) / 2), 2)
    )) km
  ) d
  WHERE d.km <= p_rayon_km
  ORDER BY (a.trouves = nb.c) DESC, d.km;
$function$;

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
SET search_path TO 'public', 'extensions'
AS $function$
  WITH req AS (
    SELECT
      (x->>'produit_id')::uuid produit_id,
      greatest(1, least(10, coalesce((x->>'quantite')::int, 1))) qte
    FROM jsonb_array_elements(p_items) x
  ),
  nb AS (
    SELECT count(*)::int c FROM req
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
     AND (s.date_peremption IS NULL OR s.date_peremption >= CURRENT_DATE)
    JOIN public.produits p ON p.id = s.produit_id
  ),
  agg AS (
    SELECT
      pharmacie_id,
      count(*)::int trouves,
      sum(prix * qte)::int total,
      jsonb_agg(
        jsonb_build_object(
          'produit_id', produit_id,
          'nom', nom,
          'dosage', dosage,
          'prix', prix,
          'quantite', quantite,
          'quantite_demandee', qte
        ) ORDER BY nom
      ) items
    FROM ok
    GROUP BY pharmacie_id
  )
  SELECT
    ph.id, ph.nom, ph.quartier, ph.adresse, ph.lat, ph.lng,
    ph.de_garde, ph.stock_updated_at, d.km,
    a.total, a.items, a.trouves, nb.c
  FROM agg a
  JOIN public.pharmacies ph ON ph.id = a.pharmacie_id AND ph.actif
  CROSS JOIN nb
  CROSS JOIN LATERAL (
    SELECT 6371 * 2 * asin(sqrt(
      power(sin(radians(ph.lat - p_lat) / 2), 2)
      + cos(radians(p_lat)) * cos(radians(ph.lat))
      * power(sin(radians(ph.lng - p_lng) / 2), 2)
    )) km
  ) d
  WHERE d.km <= p_rayon_km
  ORDER BY (a.trouves = nb.c) DESC, d.km;
$function$;
