-- Allow the explicit source marker used by pharmacy-owned product declarations.
-- The legacy constraint was created before this business flow and rejected every
-- new pharmacy declaration at INSERT time, despite valid auth/scope checks.

begin;

alter table public.produits
  drop constraint if exists produits_source_fiche_check;

alter table public.produits
  add constraint produits_source_fiche_check
  check (
    source_fiche = any (
      array[
        'aucune',
        'bdpm',
        'ia',
        'admin',
        'pharmacien',
        'declaration_pharmacie'
      ]::text[]
    )
  ) not valid;

commit;
