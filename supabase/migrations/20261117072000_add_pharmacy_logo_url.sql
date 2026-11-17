-- Persist the pharmacy logo URL independently from the storefront photo.
-- Nullable by design: existing pharmacies keep their current appearance.
alter table public.pharmacies
  add column if not exists logo_url text;

comment on column public.pharmacies.logo_url is
  'Public URL of the pharmacy logo stored in the pharmacies-photos bucket.';
