-- Keep private pharmacy-owned product descriptions inside their owner's scope.
-- Public Marketplace availability and legacy shared catalogue compatibility remain intact.

drop policy if exists produits_authenticated_live_offer_read on public.produits;

create policy produits_authenticated_live_offer_read
on public.produits
for select
to authenticated
using (
  public.marketplace_produit_visible(id)
  or (select public.is_admin())
  or (
    created_by_pharmacie_id is not null
    and (select private.naxa_scope_allows(
      auth.uid(),
      created_by_pharmacie_id,
      'PHARMACIE'
    ))
  )
  or (
    created_by_pharmacie_id is null
    and (
      (
        (select private.naxa_business_function(auth.uid()))='promoteur'
        and (select public.naxa_promoteur_valide(auth.uid()))
      )
      or (
        (select private.naxa_business_function(auth.uid())) = any (
          array[
            'pharmacie','caisse','responsable','comptable',
            'pharmacien','gestionnaire_stock','magasinier'
          ]::text[]
        )
        and (select public.my_pharmacie()) is not null
      )
    )
  )
);
