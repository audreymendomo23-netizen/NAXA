-- NAXA — photos du catalogue partenaire (Parapharmacie et Bébé & Maman).
-- Bucket public pour les images de produits ; écriture/suppression limitées au partenaire propriétaire.
BEGIN;

ALTER TABLE public.partner_products
  ADD COLUMN IF NOT EXISTS photo_path text,
  ADD COLUMN IF NOT EXISTS photo_source_url text,
  ADD COLUMN IF NOT EXISTS photo_licence text,
  ADD COLUMN IF NOT EXISTS photo_rights_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS photo_rights_confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS photo_uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.partner_products.photo_path IS
  'Chemin immuable dans partner-catalogue-photos : partner UUID / product UUID / image UUID.webp.';
COMMENT ON COLUMN public.partner_products.photo_source_url IS
  'URL HTTPS de la source originale de la photo, conservée pour traçabilité.';
COMMENT ON COLUMN public.partner_products.photo_licence IS
  'Licence ou autorisation déclarée par le partenaire pour la réutilisation commerciale de cette photo.';
COMMENT ON COLUMN public.partner_products.photo_rights_confirmed_at IS
  'Date de confirmation par le partenaire de ses droits d’utilisation ; ne constitue pas une certification juridique NAXA.';
COMMENT ON COLUMN public.partner_products.photo_rights_confirmed_by IS
  'Compte partenaire ayant confirmé les droits d’utilisation de cette photo.';
COMMENT ON COLUMN public.partner_products.photo_uploaded_by IS
  'Compte partenaire ayant téléversé cette photo dans le stockage NAXA.';

ALTER TABLE public.partner_products
  DROP CONSTRAINT IF EXISTS partner_products_photo_provenance_complete;
ALTER TABLE public.partner_products
  ADD CONSTRAINT partner_products_photo_provenance_complete
  CHECK (
    photo_path IS NULL
    OR (
      photo_url IS NOT NULL
      AND photo_source_url IS NOT NULL
      AND photo_source_url ~* '^https://'
      AND photo_licence IS NOT NULL
      AND length(photo_licence) BETWEEN 5 AND 500
      AND photo_rights_confirmed_at IS NOT NULL
      AND photo_rights_confirmed_by IS NOT NULL
      AND photo_uploaded_by IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS partner_products_photo_path_idx
  ON public.partner_products(photo_path)
  WHERE photo_path IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'partner-catalogue-photos',
  'partner-catalogue-photos',
  true,
  2097152,
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

-- Objects are immutable: replace a photo by uploading a new UUID path.
-- Object keys are partner_id/product_id/file_uuid.webp.
DO $policies$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='partner_catalogue_photo_insert'
  ) THEN
    CREATE POLICY partner_catalogue_photo_insert
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'partner-catalogue-photos'
      AND array_length(string_to_array(name, '/'), 1) = 3
      AND split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND split_part(name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND split_part(name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
      AND EXISTS (
        SELECT 1
        FROM public.partner_products pp
        JOIN public.partner_members pm ON pm.partner_id = pp.partner_id
        JOIN public.partners pa ON pa.id = pp.partner_id AND pa.status = 'active'
        JOIN public.partner_universes pu
          ON pu.partner_id = pp.partner_id
         AND pu.universe_slug = pp.universe_slug
         AND pu.enabled IS TRUE
        WHERE pp.partner_id::text = split_part(name, '/', 1)
          AND pp.id::text = split_part(name, '/', 2)
          AND pp.universe_slug IN ('parapharmacie', 'bebe-maman')
          AND pp.status <> 'archived'
          AND pm.user_id = (SELECT auth.uid())
          AND pm.member_role IN ('owner', 'manager', 'operator')
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='partner_catalogue_photo_delete'
  ) THEN
    CREATE POLICY partner_catalogue_photo_delete
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'partner-catalogue-photos'
      AND array_length(string_to_array(name, '/'), 1) = 3
      AND split_part(name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
      AND EXISTS (
        SELECT 1
        FROM public.partner_products pp
        JOIN public.partner_members pm ON pm.partner_id = pp.partner_id
        JOIN public.partners pa ON pa.id = pp.partner_id AND pa.status = 'active'
        JOIN public.partner_universes pu
          ON pu.partner_id = pp.partner_id
         AND pu.universe_slug = pp.universe_slug
         AND pu.enabled IS TRUE
        WHERE pp.partner_id::text = split_part(name, '/', 1)
          AND pp.id::text = split_part(name, '/', 2)
          AND pm.user_id = (SELECT auth.uid())
          AND pm.member_role IN ('owner', 'manager', 'operator')
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='partner_catalogue_photo_owner_read'
  ) THEN
    CREATE POLICY partner_catalogue_photo_owner_read
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'partner-catalogue-photos'
      AND EXISTS (
        SELECT 1
        FROM public.partner_products pp
        JOIN public.partner_members pm ON pm.partner_id = pp.partner_id
        WHERE pp.partner_id::text = split_part(name, '/', 1)
          AND pp.id::text = split_part(name, '/', 2)
          AND pp.photo_path = name
          AND pm.user_id = (SELECT auth.uid())
          AND pm.member_role IN ('owner', 'manager', 'operator')
      )
    );
  END IF;
END
$policies$;

COMMIT;
