-- NAXA — contrat du stockage des photos catalogue partenaire.
-- Contrôles structurels ; les octets réels sont vérifiés par scripts/storage-e2e.cjs.
BEGIN;

DO $test$
DECLARE
  v_public boolean;
  v_limit bigint;
  v_mimes text[];
  v_expr text;
BEGIN
  SELECT public, file_size_limit, allowed_mime_types
    INTO v_public, v_limit, v_mimes
  FROM storage.buckets
  WHERE id='partner-catalogue-photos';

  IF NOT FOUND
     OR v_public IS DISTINCT FROM TRUE
     OR v_limit <> 2097152
     OR NOT (v_mimes @> ARRAY['image/jpeg','image/png','image/webp']) THEN
    RAISE EXCEPTION 'Le bucket partner-catalogue-photos n’est pas configuré comme attendu';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid='public.partner_products'::regclass
      AND attname='photo_path' AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid='public.partner_products'::regclass
      AND attname='photo_source_url' AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid='public.partner_products'::regclass
      AND attname='photo_licence' AND NOT attisdropped
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_attribute
    WHERE attrelid='public.partner_products'::regclass
      AND attname='photo_rights_confirmed_at' AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'Les champs de provenance et de droits photo sont incomplets';
  END IF;

  SELECT with_check INTO v_expr
  FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects'
    AND policyname='partner_catalogue_photo_insert' AND cmd='INSERT';

  IF v_expr IS NULL
     OR position('auth.uid()' in v_expr)=0
     OR position('partner_members' in v_expr)=0
     OR position('partner_products' in v_expr)=0
     OR position('partner_universes' in v_expr)=0
     OR position('partner-catalogue-photos' in v_expr)=0 THEN
    RAISE EXCEPTION 'Le dépôt photo ne vérifie pas le membre actif et le produit de son partenaire';
  END IF;

  SELECT qual INTO v_expr
  FROM pg_policies
  WHERE schemaname='storage' AND tablename='objects'
    AND policyname='partner_catalogue_photo_delete' AND cmd='DELETE';

  IF v_expr IS NULL
     OR position('auth.uid()' in v_expr)=0
     OR position('partner_members' in v_expr)=0
     OR position('partner_products' in v_expr)=0 THEN
    RAISE EXCEPTION 'La suppression photo n’est pas limitée au produit partenaire';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND cmd='UPDATE'
      AND coalesce(qual,'') ILIKE '%partner-catalogue-photos%'
  ) THEN
    RAISE EXCEPTION 'Les objets photo catalogue doivent être remplacés par nouveau chemin, pas écrasés';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='partner_products'
      AND policyname='partner_products_member_manage' AND cmd='ALL'
  ) THEN
    RAISE EXCEPTION 'La politique existante de gestion du catalogue partenaire est absente';
  END IF;
END
$test$;

ROLLBACK;
SELECT 'partner_catalogue_photo_storage_contract PASS' AS resultat;
