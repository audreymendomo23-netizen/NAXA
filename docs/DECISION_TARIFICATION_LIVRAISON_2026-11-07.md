# Décision métier — Tarification des livraisons NAXA

**Date de validation : 7 novembre 2026**  
**Périmètre :** livraison nationale NAXA, devis client, commission plateforme et reporting financier.

## Règle de calcul

Le tarif total facturé au Client est calculé côté serveur à partir de la distance routière réelle entre la pharmacie et l'adresse GPS du Client.

\[
\text{Tarif client}=\min(3\,500,\ 1\,500+100\times\max(0,\text{distance routière}-2,5))
\]

- Forfait de **1 500 FCFA jusqu'à 2,5 km inclus**.
- Au-delà de 2,5 km : **100 FCFA par kilomètre supplémentaire**, calculé au prorata et arrondi au FCFA le plus proche.
- Minimum : **1 500 FCFA**.
- Maximum : **3 500 FCFA**, atteint à partir de 22,5 km.
- Un itinéraire routier réel est requis; aucune distance à vol d'oiseau ni estimation de secours ne peut servir à facturer.

### Exemples vérifiables

| Distance routière | Tarif client |
|---:|---:|
| 1,5 km | 1 500 FCFA |
| 2,5 km | 1 500 FCFA |
| 3 km | 1 550 FCFA |
| 5 km | 1 750 FCFA |
| 10 km | 2 250 FCFA |
| 22,5 km | 3 500 FCFA |

## Ventilation financière

Pour chaque livraison effectivement terminée :

- Commission NAXA fixe : **500 FCFA**.
- Solde affecté au service de livraison : **tarif client − 500 FCFA**.
- La ventilation doit toujours se réconcilier : tarif client = commission NAXA + solde livraison.

Exemple à 5 km : tarif client 1 750 FCFA = 500 FCFA commission NAXA + 1 250 FCFA solde livraison.

## Visibilité par rôle

- **Client :** voit uniquement le tarif total de livraison calculé (ex. 1 550 FCFA à 3 km). Aucun montant, libellé ou détail de commission NAXA n'est affiché.
- **Administration :** voit le détail et les agrégats des commissions acquises, réglées et à régler.
- **Promoteur :** voit le rapport de commission limité à son réseau de pharmacies, avec le détail par pharmacie et les décomptes.
- La commission ne s'ajoute pas une seconde fois au montant Client : elle est comprise dans le tarif total.

## Comptabilisation

La commission de 500 FCFA est inscrite une seule fois dans le grand livre lors de la confirmation effective de la livraison par le Client et le Livreur. Le règlement est suivi dans le décompte périodique de la pharmacie; les anciennes écritures comptables sont conservées et ne sont pas recalculées selon la nouvelle grille.

## Contrôles techniques

- Le tarif est calculé côté serveur à partir d'un trajet routier.
- Le devis est lié au Client authentifié, à la pharmacie, aux coordonnées et expire après dix minutes.
- Le trigger SQL vérifie et consomme le devis; les prix et distances envoyés par le navigateur ne sont pas fiables.
- Les écrans Client ne reçoivent pas la ventilation de commission.
- Toute nouvelle écriture financière fixe la commission à 500 FCFA et conserve un solde livraison d'au moins 1 000 FCFA.
- Cette règle est construite sur la branche QA `qa/e2e-stabilisation-20261106`; elle n'est pas une autorisation de déploiement Production.
