-- NAXA 076 — métadonnées produit additives.
begin;
alter table public.produits add column if not exists sur_ordonnance boolean not null default false;
alter table public.produits add column if not exists fabricant text;
alter table public.produits add constraint produits_fabricant_longueur check (fabricant is null or char_length(fabricant)<=160);
commit;
