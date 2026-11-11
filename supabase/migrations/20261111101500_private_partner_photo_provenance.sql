-- NAXA — isoler la provenance photo du catalogue public.
-- La table partner_products reste lisible pour le catalogue client ; ses métadonnées
-- de licence, source et identité de déclaration sont déplacées sous RLS partenaire.
BEGIN;

ALTER TABLE public.partner_products
  DROP CONSTRAINT IF EXISTS partner_products_photo_provenance_complete;
ALTER TABLE public.partner_products
  ADD CONSTRAINT partner_products_photo_path_valid
  CHECK (
    photo_path IS NULL
    OR (
      photo_url IS NOT NULL
      AND split_part(photo_path, '/', 1) = partner_id::text
      AND split_part(photo_path, '/', 2) = id::text
      AND split_part(photo_path, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.webp$'
    )
  );

ALTER TABLE public.partner_products
  DROP COLUMN IF EXISTS photo_source_url,
  DROP COLUMN IF EXISTS photo_licence,
  DROP COLUMN IF EXISTS photo_rights_confirmed_at,
  DROP COLUMN IF EXISTS photo_rights_confirmed_by,
  DROP COLUMN IF EXISTS photo_uploaded_by;

CREATE TABLE IF NOT EXISTS public.partner_product_photo_provenance (
  product_id uuid PRIMARY KEY REFERENCES public.partner_products(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  universe_slug text NOT NULL CHECK (universe_slug IN ('parapharmacie', 'bebe-maman')),
  source_url text NOT NULL CHECK (source_url ~* '^https://'),
  licence text NOT NULL CHECK (length(btrim(licence)) BETWEEN 5 AND 500),
  rights_confirmed_at timestamptz NOT NULL DEFAULT now(),
  rights_confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_product_photo_provenance_partner_idx
  ON public.partner_product_photo_provenance(partner_id, universe_slug);

ALTER TABLE public.partner_product_photo_provenance ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.partner_product_photo_provenance FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_product_photo_provenance TO authenticated;

DROP POLICY IF EXISTS partner_product_photo_provenance_member_manage
  ON public.partner_product_photo_provenance;
CREATE POLICY partner_product_photo_provenance_member_manage
ON public.partner_product_photo_provenance
FOR ALL TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.partner_products pp
    JOIN public.partners pa ON pa.id = pp.partner_id AND pa.status = 'active'
    JOIN public.partner_members pm ON pm.partner_id = pp.partner_id
    JOIN public.partner_universes pu
      ON pu.partner_id = pp.partner_id
     AND pu.universe_slug = pp.universe_slug
     AND pu.enabled IS TRUE
    WHERE pp.id = partner_product_photo_provenance.product_id
      AND pp.partner_id = partner_product_photo_provenance.partner_id
      AND pp.universe_slug = partner_product_photo_provenance.universe_slug
      AND pm.user_id = (SELECT auth.uid())
      AND pm.member_role IN ('owner', 'manager', 'operator')
  )
)
WITH CHECK (
  (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.partner_products pp
      JOIN public.partners pa ON pa.id = pp.partner_id AND pa.status = 'active'
      JOIN public.partner_members pm ON pm.partner_id = pp.partner_id
      JOIN public.partner_universes pu
        ON pu.partner_id = pp.partner_id
       AND pu.universe_slug = pp.universe_slug
       AND pu.enabled IS TRUE
      WHERE pp.id = partner_product_photo_provenance.product_id
        AND pp.partner_id = partner_product_photo_provenance.partner_id
        AND pp.universe_slug = partner_product_photo_provenance.universe_slug
        AND pm.user_id = (SELECT auth.uid())
        AND pm.member_role IN ('owner', 'manager', 'operator')
    )
  )
  AND (
    public.is_admin()
    OR (
      rights_confirmed_by = (SELECT auth.uid())
      AND uploaded_by = (SELECT auth.uid())
    )
  )
);

CREATE OR REPLACE FUNCTION public.partner_link_catalogue_photo(
  p_partner_id uuid,
  p_product_id uuid,
  p_photo_path text,
  p_photo_url text,
  p_source_url text,
  p_licence text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_universe text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE='28000';
  END IF;
  IF p_partner_id IS NULL OR p_product_id IS NULL
     OR p_photo_path IS NULL OR p_photo_url IS NULL
     OR p_source_url IS NULL OR p_licence IS NULL
     OR p_source_url !~* '^https://'
     OR length(btrim(p_licence)) NOT BETWEEN 5 AND 500
     OR p_photo_path !~* (
       '^' || p_partner_id::text || '/' || p_product_id::text ||
       '/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.webp$'
     )
     OR p_photo_url !~* '^https://[^/]+/storage/v1/object/public/partner-catalogue-photos/'
     OR right(p_photo_url, length(p_photo_path)) <> p_photo_path THEN
    RAISE EXCEPTION 'Provenance ou chemin de photo invalide' USING ERRCODE='22023';
  END IF;

  SELECT pp.universe_slug INTO v_universe
  FROM public.partner_products pp
  JOIN public.partners pa ON pa.id = pp.partner_id AND pa.status = 'active'
  WHERE pp.id = p_product_id
    AND pp.partner_id = p_partner_id
    AND pp.status <> 'archived'
    AND pp.universe_slug IN ('parapharmacie', 'bebe-maman')
    AND EXISTS (
      SELECT 1 FROM public.partner_members pm
      WHERE pm.partner_id = pp.partner_id
        AND pm.user_id = v_user
        AND pm.member_role IN ('owner', 'manager', 'operator')
    )
    AND EXISTS (
      SELECT 1 FROM public.partner_universes pu
      WHERE pu.partner_id = pp.partner_id
        AND pu.universe_slug = pp.universe_slug
        AND pu.enabled IS TRUE
    )
  FOR UPDATE OF pp;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit ou partenaire non autorisé' USING ERRCODE='42501';
  END IF;

  INSERT INTO public.partner_product_photo_provenance(
    product_id, partner_id, universe_slug, source_url, licence,
    rights_confirmed_at, rights_confirmed_by, uploaded_by, updated_at
  ) VALUES (
    p_product_id, p_partner_id, v_universe, p_source_url, btrim(p_licence),
    now(), v_user, v_user, now()
  )
  ON CONFLICT (product_id) DO UPDATE
  SET partner_id = EXCLUDED.partner_id,
      universe_slug = EXCLUDED.universe_slug,
      source_url = EXCLUDED.source_url,
      licence = EXCLUDED.licence,
      rights_confirmed_at = EXCLUDED.rights_confirmed_at,
      rights_confirmed_by = EXCLUDED.rights_confirmed_by,
      uploaded_by = EXCLUDED.uploaded_by,
      updated_at = EXCLUDED.updated_at;

  UPDATE public.partner_products
  SET photo_url = p_photo_url,
      photo_path = p_photo_path,
      updated_at = now()
  WHERE id = p_product_id
    AND partner_id = p_partner_id;

  RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.partner_link_catalogue_photo(uuid, uuid, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_link_catalogue_photo(uuid, uuid, text, text, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.partner_unlink_catalogue_photo(
  p_partner_id uuid,
  p_product_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Connexion requise' USING ERRCODE='28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.partner_products pp
    JOIN public.partners pa ON pa.id = pp.partner_id AND pa.status = 'active'
    WHERE pp.id = p_product_id
      AND pp.partner_id = p_partner_id
      AND EXISTS (
        SELECT 1 FROM public.partner_members pm
        WHERE pm.partner_id = pp.partner_id
          AND pm.user_id = v_user
          AND pm.member_role IN ('owner', 'manager', 'operator')
      )
  ) THEN
    RAISE EXCEPTION 'Produit ou partenaire non autorisé' USING ERRCODE='42501';
  END IF;

  DELETE FROM public.partner_product_photo_provenance
  WHERE product_id = p_product_id
    AND partner_id = p_partner_id;

  UPDATE public.partner_products
  SET photo_url = NULL, photo_path = NULL, updated_at = now()
  WHERE id = p_product_id AND partner_id = p_partner_id;

  RETURN TRUE;
END;
$function$;

REVOKE ALL ON FUNCTION public.partner_unlink_catalogue_photo(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_unlink_catalogue_photo(uuid, uuid)
  TO authenticated;

COMMIT;
