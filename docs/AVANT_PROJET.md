# NAXA — Avant-projet Pilotage & Vente 360°

Objectif : relier recherche, fiche, panier, réservation, retrait/paiement, vente, indicateurs et rapports.

## Hiérarchie
- N1 NAXA : réseau, demande, conversion, pharmacies, qualité, revenus, support.
- N2 Promoteur : performance de sa pharmacie, CA, ventes, stock, équipe et rapports.
- N3 Caisse : commandes, stock, alertes et activité de la même pharmacie.

## Contradictions traitées
- Collision du numéro de migration 006 : le pilotage utilise 009 pour ne pas toucher à l’authentification existante.
- Une caisse n’est jamais une sous-pharmacie.
- Prix d’achat séparé du stock public.
- Lots et péremptions séparés et invisibles au client.
- Pas de Patient 360 nominatif dans la BI.
- Envoi e-mail uniquement côté serveur.
- Données de démonstration excluables par est_demo.

## Chaîne de données
Evenements → demande/entonnoir ; Reservations → flux commercial ; Stocks → disponibilité/prix ; Stocks_couts → coûts ; Stocks_lots → lots ; Rapports → snapshots ; BI → agrégats.

Aucun merge main, aucune migration appliquée et aucun déploiement Production à ce stade.
