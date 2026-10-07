# NAXA — Gouvernance des documents maîtres

## Objectif

Empêcher que plusieurs IA ou plusieurs chantiers écrivent simultanément des versions concurrentes des documents de pilotage.

## Documents protégés

- `FONCTIONNALITES_VALIDEES.md`
- `README.md`
- `Statut.md`, lorsqu'il existe à la racine
- `docs/REGISTRE_GOUVERNANCE.md`

## Règle d'unicité

Un seul processus d'intégration est autorisé à modifier le registre maître au cours d'un chantier.

Les autres IA peuvent auditer, produire des résultats et preuves, modifier leur code de chantier et proposer un delta documentaire. Elles ne doivent pas créer chacune une version concurrente du registre maître.

## Séquence obligatoire

1. Lire la version actuelle de `main`.
2. Vérifier le SHA de `main`.
3. Récupérer les modifications déjà intégrées.
4. Réappliquer uniquement le delta nouveau.
5. Vérifier qu'aucun 🟢 n'est rétrogradé.
6. Produire un **commit documentaire d'intégration**.
7. Recontrôler le SHA de `main`.

## Convention de commit

Les commits qui modifient un document maître doivent utiliser :

`docs(registry-integrator):`

Exemple : `docs(registry-integrator): mise à jour du registre après LOT A`

Les modifications documentaires compatibles d'un même chantier doivent être regroupées dans un seul commit d'intégration.

## Règle anti-écrasement

Une IA travaillant avec un état ancien de `main` ne doit jamais remplacer le document maître avec sa copie ancienne.

Si le SHA de base a changé :

**STOP → relire main → réappliquer uniquement le delta → vérifier → intégrer.**

## Règle anti-régression

Un 🟢 ne peut être modifié que si une régression est démontrée.

## Preuve

Toute modification du registre doit permettre de retrouver le SHA parent, le SHA du commit d'intégration, la date, le motif, le chantier concerné et les preuves ayant justifié le changement.

## Limite

Cette gouvernance automatise le contrôle. Elle ne remplace pas une règle GitHub de branche/review obligatoire tant que celle-ci n'est pas activée côté dépôt.
