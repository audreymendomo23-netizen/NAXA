-- The public catalog may expose only pharmacist/admin-validated product records.
-- Pharmacy staff can still prepare drafts inside an active pharmacy workspace,
-- but cannot publish a record by setting fiche_validee during INSERT.

begin;

drop policy if exists produits_read on public.produits;
drop policy if exists produits_public_validated_read on public.produits;
drop policy if exists produits_authenticated_catalog_read on public.produits;

create policy produits_public_validated_read
on public.produits
for select
to anon
using (fiche_validee is true);

create policy produits_authenticated_catalog_read
on public.produits
for select
to authenticated
using (
  fiche_validee is true
  or (select public.is_admin())
  or (
    (select private.naxa_business_function(auth.uid())) in (
      'pharmacie',
      'caisse',
      'responsable',
      'comptable',
      'pharmacien',
      'gestionnaire_stock',
      'magasinier'
    )
    and (select public.my_pharmacie()) is not null
  )
);

drop policy if exists produits_write on public.produits;

create policy produits_write
on public.produits
for insert
to authenticated
with check (
  (select public.is_admin())
  or (
    fiche_validee is not true
    and (select private.naxa_business_function(auth.uid())) in (
      'pharmacie',
      'caisse',
      'responsable',
      'comptable',
      'pharmacien',
      'gestionnaire_stock',
      'magasinier'
    )
    and (select public.my_pharmacie()) is not null
  )
);

commit;
