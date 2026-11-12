-- Le parcours de recherche depuis le panier doit utiliser le même stock vendable frais.
begin;
CREATE OR REPLACE FUNCTION private.search_pharmacies_panier(p_items jsonb, p_lat double precision, p_lng double precision, p_rayon_km double precision DEFAULT 20)
 RETURNS TABLE(pharmacie_id uuid, nom text, quartier text, adresse text, lat double precision, lng double precision, de_garde boolean, stock_updated_at timestamp with time zone, distance_km double precision, total_prix integer, items jsonb, trouves integer, demandes integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
WITH req AS (
  SELECT (x->>'produit_id')::uuid produit_id,
    GREATEST(1,LEAST(10,COALESCE((x->>'quantite')::integer,1))) qte
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p_items)='array' THEN p_items ELSE '[]'::jsonb END) x
),
nb AS (SELECT count(*)::integer c FROM req),
ok AS (
  SELECT s.pharmacie_id,s.produit_id,p.nom,p.dosage,offre.prix,offre.quantite,r.qte
  FROM req r
  JOIN public.stocks s ON s.produit_id=r.produit_id
  JOIN LATERAL public.marketplace_offre_stock_disponible(s.pharmacie_id,s.produit_id) offre
    ON offre.quantite>=r.qte
  JOIN public.pharmacies ph ON ph.id=s.pharmacie_id
    AND ph.actif IS TRUE AND ph.visible_recherche IS TRUE
    AND ph.est_demo IS FALSE AND ph.archivee_le IS NULL
  JOIN public.produits p ON p.id=s.produit_id
),
agg AS (
  SELECT pharmacie_id,count(*)::integer trouves,sum(prix*qte)::integer total,
    jsonb_agg(jsonb_build_object('produit_id',produit_id,'nom',nom,'dosage',dosage,
      'prix',prix,'quantite',quantite,'quantite_demandee',qte) ORDER BY nom) items
  FROM ok GROUP BY pharmacie_id
)
SELECT ph.id,ph.nom,ph.quartier,ph.adresse,ph.lat,ph.lng,ph.de_garde,ph.stock_updated_at,d.km,
  a.total,a.items,a.trouves,nb.c
FROM agg a
JOIN public.pharmacies ph ON ph.id=a.pharmacie_id AND ph.actif IS TRUE
  AND ph.visible_recherche IS TRUE AND ph.est_demo IS FALSE AND ph.archivee_le IS NULL
CROSS JOIN nb
CROSS JOIN LATERAL (
  SELECT 6371*2*asin(sqrt(
    power(sin(radians(ph.lat-p_lat)/2),2)
    +cos(radians(p_lat))*cos(radians(ph.lat))*power(sin(radians(ph.lng-p_lng)/2),2)
  )) km
) d
WHERE p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180
  AND d.km<=LEAST(GREATEST(COALESCE(p_rayon_km,20),1),100)
ORDER BY (a.trouves=nb.c) DESC,d.km;
$function$
;
commit;
