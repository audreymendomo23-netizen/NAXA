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


## Contradiction C4 — CA canonique
`v_reservations_ca` est la source canonique des ventes/CA : une réservation est qualifiante si son statut est `payee` ou `retiree`. Le grain est `réservation`, donc un changement `payee → retiree` ne double jamais le CA. `v_ventes_journalieres` et `bi.activite_mensuelle` consomment cette règle. La vue est `security_invoker=true` afin de respecter les protections sous-jacentes conformément aux pratiques Supabase. citeturn2search0turn2search1
