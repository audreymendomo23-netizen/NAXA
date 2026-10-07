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
