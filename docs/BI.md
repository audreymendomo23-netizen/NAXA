# BI NAXA

Le schéma bi est destiné à la lecture analytique. Les vues sont agrégées et les pharmacies est_demo=true sont exclues du réseau.

Vues : bi.activite_mensuelle et bi.stock_pharmacies.

## Coût d'achat — règle canonique
`stocks` porte le prix public/vente et la quantité ; `stocks_couts` porte le coût d'achat interne courant, au grain `pharmacie × produit`, en XAF. Les deux ne sont jamais additionnés ni confondus.

`stocks_couts` peut alimenter la valorisation courante du stock pour les scopes internes autorisés. Il ne permet pas à lui seul de calculer une marge historique de vente : aucun KPI de marge transactionnelle n'est publié tant qu'un coût au moment de la vente n'est pas figé dans la donnée transactionnelle.


## Convention monétaire d'affichage
Les données et règles techniques utilisent le code ISO **XAF**. Les interfaces destinées aux humains, en particulier la vue Client, affichent **FCFA**. Cette différence est purement présentationnelle : aucun taux de conversion ni changement de devise n'est appliqué.

## Contradiction C3 — source canonique de recherche
Pour les KPI BI, `public.evenements` est la source canonique des recherches : `type='recherche'` porte le volume, le nombre de résultats et la zone anonymisée nécessaires au funnel. `public.recherche_events` est conservée pour la compatibilité historique du bandeau « Les plus recherchés » et n'entre pas dans les agrégations KPI. Il est interdit de sommer les deux sources ou de les joindre pour compter les recherches.
