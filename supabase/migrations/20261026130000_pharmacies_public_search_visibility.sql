-- NAXA Preview compatibility: pharmacy catalogue visibility fields used by public search
-- and Baby & Maman ownership resolution.
begin;

alter table public.pharmacies
  add column if not exists visible_recherche boolean not null default true,
  add column if not exists est_demo boolean not null default false,
  add column if not exists archivee_le timestamptz;

commit;
