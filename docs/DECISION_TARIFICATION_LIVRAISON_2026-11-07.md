# Décision métier — Tarification des livraisons NAXA

**Date de validation : 7 novembre 2026**  
**Périmètre :** livraison nationale NAXA, devis client, commission plateforme et reporting financier.

## Règle de calcul

Le tarif total facturé au Client est calculé depuis la distance routière réelle entre la pharmacie et l'adresse GPS du Client :

\[
\text{Tarif client}=\min(3\,500,\max(1\,500,1\,500+200\times\text{distance routière en km}))
\]

- Minimum : **1 500 FCFA**.
- Majoration kilométrique : **200 FCFA/km**.
- Maximum : **3 500 FCFA**.
- Un itinéraire routier réel est requis; aucune estimation à vol d'oiseau ne peut servir à facturer.

## Ventilation financière

Pour chaque livraison effectivement terminée :

- Commission NAXA fixe : **500 FCFA**.
- Solde affecté au service de livraison : **tarif client − 500 FCFA**.
- La ventilation doit toujours se réconcilier : tarif client = commission NAXA + solde livraison.

Exemple à 1,5 km : tarif client 1 800 FCFA = 500 FCFA commission NAXA + 1 300 FCFA solde livraison.

## Visibilité par rôle

- **Client :** voit uniquement le tarif total de livraison calculé (ex. 1 800 FCFA). Aucun montant, libellé ou détail de commission NAXA n'est affiché.
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

