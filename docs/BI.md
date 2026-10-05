# BI NAXA

Le schéma bi est destiné à la lecture analytique. Les vues sont agrégées et les pharmacies est_demo=true sont exclues du réseau.

Vues : bi.activite_mensuelle et bi.stock_pharmacies.

## Coût d'achat — règle canonique
`stocks` porte le prix public/vente et la quantité ; `stocks_couts` porte le coût d'achat interne courant, au grain `pharmacie × produit`, en XAF. Les deux ne sont jamais additionnés ni confondus.

`stocks_couts` peut alimenter la valorisation courante du stock pour les scopes internes autorisés. Il ne permet pas à lui seul de calculer une marge historique de vente : aucun KPI de marge transactionnelle n'est publié tant qu'un coût au moment de la vente n'est pas figé dans la donnée transactionnelle.
