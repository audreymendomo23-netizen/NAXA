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


## Export
- Source : rapport déjà autorisé.
- Format actuel : CSV côté interface ; PDF pour l'envoi automatique existant.
- Règle : l'export ne peut jamais élargir le scope.
\n\nMatrice BI/RLS multi-pharmacie : Promoteur = pharmacies explicitement accréditées ; Responsable = périmètre autorisé, avec compatibilité actuelle via `profiles.pharmacie_id` ; Caisse = pharmacie opérationnelle ; NAXA = global ; Client = hors hiérarchie interne.\n