# NAXA — HISTORIQUE DES CHECKPOINTS

Les checkpoints sont append-only. Le dernier checkpoint actif est indiqué dans `docs/NAXA_REPRISE_EXACTE.md`.

## CP-0001-CONTINUITE

- Date : 07/10/2026
- Objet : installation du système de continuité déterministe.
- Branche : `rewrite/naxa-from-main-20261007`
- SHA d'ancrage avant installation : `f644b4d42a48cda57cc1a7d9c6f26867852ac56e`
- Parties fonctionnelles : 1 à 4 🟢 ; Partie 5 🟡.
- Action fonctionnelle suivante : résoudre la preuve CI de la Partie 5.
- Règle : ne pas refaire les parties vertes.


## CP-0002-PART6-CLOTURE

- Date : 07/10/2026
- Objet : clôture de la Partie 6 et ouverture contrôlée du chantier Pilotage 360°.
- Branche : `rewrite/naxa-from-main-20261007`
- SHA fonctionnel de clôture Partie 6 : `4d8fb7c43ebc8642e644e96aeec4f37969c93a82`.
- Parties fonctionnelles : 1 à 6 🟢.
- Preuve : Supabase transactionnel PASS + ROLLBACK ; CircleCI pipeline #13 / `part6_gate` / `part6_check` = Success.
- Documentation réconciliée : MASTER_INDEX, REPRISE_EXACTE, STATUT et README.
- Action fonctionnelle suivante : Pilotage 360° — Partie 1, audit + matrice KPI canonique.
- Règle : aucun codage KPI avant résolution des contradictions cahier V3.7 ↔ code ↔ DB ↔ documentation.


## CP-0003-PILOTAGE360-PART1

- Date : 07/10/2026
- Objet : clôture de la Partie 1 du chantier Pilotage 360°.
- Branche : `rewrite/naxa-from-main-20261007`
- Partie : Pilotage 360° — Partie 1, audit canonique.
- Preuve documentaire : `docs/PILOTAGE_360_AUDIT_PARTIE1.md`.
- Contrôles structurels : C1→C6 PASS.
- Résultat : 🟢 VERT — 100 %.
- Prochaine étape : Pilotage 360° — Partie 2, socle Performance.
- Interdiction : aucun KPI nouveau, aucune migration Production et aucun contournement du CA canonique avant validation de la Partie 2.


## CP-0004-PILOTAGE360-PART2-REPRISE

- Date : 07/10/2026
- Objet : reprise/correction du socle Performance de la Partie 2.
- Branche : rewrite/naxa-from-main-20261007.
- Contradiction corrigée : le test 049 ne créait pas les pharmacies référencées par ses fixtures ; p1 actif et p2 inactif sont désormais créés transactionnellement.
- Correction CI : exécuteur CircleCI machine pour supprimer l’isolation Docker/remote-Docker et permettre le replay Supabase local ; no_output_timeout porté à 30 min.
- Derniers commits : test 5c92278765f23768c9590b82257d98251466f95e ; CI 81dc2673ca9b182776ab87fbebbbe230ce8c9a5a ; documentation 6c435c120e5183bfe7e9bd829e542cbbfe923619.
- Preuve : aucun status CI CircleCI remonté par GitHub à cet instant.
- Statut : 🟠 NON VERT — attente de preuve fonctionnelle ; ne pas passer à la Partie 3.
