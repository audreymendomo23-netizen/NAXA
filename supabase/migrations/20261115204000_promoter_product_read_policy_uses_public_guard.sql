-- Keep promoter catalogue reads behind the public self-scoped validity wrapper.
-- The private helper intentionally has no EXECUTE grant to API roles; using it
-- directly inside an RLS policy raises 42501 for authenticated promoters.

drop policy if exists produits_authenticated_live_offer_read on public.produits;

create policy produits_authenticated_live_offer_read
on public.produits
for select
to authenticated
using (
  public.marketplace_produit_visible(id)
  or (select public.is_admin())
  or (
    (select private.naxa_business_function(auth.uid()))='promoteur'
    and (select public.naxa_promoteur_valide(auth.uid()))
  )
  or (
    (select private.naxa_business_function(auth.uid())) in (
      'pharmacie','caisse','responsable','comptable','pharmacien',
      'gestionnaire_stock','magasinier'
    )
    and (select public.my_pharmacie()) is not null
  )
);
