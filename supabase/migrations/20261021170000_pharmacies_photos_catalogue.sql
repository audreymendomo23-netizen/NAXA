-- NAXA — verified pharmacy photos for Yaoundé and other cities.
-- Only public, authorized images should be uploaded to this bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pharmacies-photos', 'pharmacies-photos', true, 524288, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.pharmacies
  add column if not exists photo_url text,
  add column if not exists photo_source_url text,
  add column if not exists photo_verified_at timestamptz;

comment on column public.pharmacies.photo_url is
  'URL publique de la photo réelle de cette pharmacie, idéalement hébergée dans le bucket pharmacies-photos.';
comment on column public.pharmacies.photo_source_url is
  'URL de la source originale et attribution de la photo; vérifier les droits avant réhébergement.';
comment on column public.pharmacies.photo_verified_at is
  'Date de vérification que la photo correspond bien à cette officine.';

create index if not exists pharmacies_photo_verified_idx
  on public.pharmacies (photo_verified_at desc)
  where photo_url is not null;
 
