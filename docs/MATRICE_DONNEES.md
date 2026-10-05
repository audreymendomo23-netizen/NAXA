# Matrice de données

Client : disponibilité et prix publics.
Caisse : stock, commandes, lots/péremptions et alertes de sa pharmacie.
Promoteur : périmètre caisse + performance et coûts de sa pharmacie.
NAXA : réseau, support et administration.
BI : agrégats sans identité client.

Coût d'achat : Promoteur/NAXA uniquement via `stocks_couts` dans le périmètre autorisé. Client et Caisse ne reçoivent pas le coût d'achat via la BI.


## Recherche — source canonique
- **Client** : génère le parcours de recherche ; aucun accès direct aux données analytiques internes.
- **KPI BI / rapports** : `evenements` est la source canonique.
- **Compatibilité historique** : `recherche_events` alimente uniquement le mécanisme historique « Les plus recherchés » et est exclue des KPI.
- **Règle anti-double-compte** : ne jamais additionner `evenements` et `recherche_events`.

## Devise
- Données/contrats techniques : XAF.
- Affichage Client : **FCFA**.
