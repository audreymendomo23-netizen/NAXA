-- Allow pharmacy illustration fallbacks to be stored alongside real photos.
-- The illustration is explicitly labelled and must never be treated as a verified real photo.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY(
  SELECT DISTINCT mime
  FROM unnest(COALESCE(allowed_mime_types, ARRAY[]::text[]) || ARRAY['image/svg+xml']::text[]) AS mime
  ORDER BY mime
),
updated_at = now()
WHERE id = 'pharmacies-photos';
