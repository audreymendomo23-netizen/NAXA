# NAXA — FONCTIONNALITÉS VALIDÉES

> Registre opérationnel permanent des fonctionnalités et blocs construits de NAXA.
> Chaque bloc créé doit être consigné immédiatement avec son statut réel.

## 1. Règle de fonctionnement

Pour chaque nouvelle fonctionnalité ou page :

1. Construire.
2. Contrôler à son niveau possible.
3. Consigner immédiatement le bloc ici.
4. Renseigner tous les détails disponibles : branche, commit, fichiers, routes, migrations, tests et preuves.
5. Attribuer un statut réel, sans transformer un blocage externe en faux vert.
6. Avancer sur les éléments indépendants.
7. Lors d'une reprise, relire cette fiche avant toute modification.
8. Toute correction ou régression met à jour l'entrée sans effacer l'historique utile.

## 2. Niveaux de validation

| Niveau | Signification |
|---|---|
| 🟡 Statique | Code/page/route présente et inspectée. |
| 🟢 Technique | Compilation, tests, DB, sécurité et autres contrôles techniques effectivement prouvés. |
| 🟢 Fonctionnelle | Flux métier effectivement vérifié, y compris cas nominaux et interdits pertinents. |
| 🟢 Production | Déploiement Production autorisé et comportement vérifié en Production. |

### Statuts globaux

- 🟢 VALIDÉ : le niveau annoncé est effectivement prouvé.
- 🟡 VALIDÉ — À COMPLÉTER : le bloc est construit et son état est connu, mais une validation supérieure ou une preuve manque.
- 🔴 À CORRIGER : contradiction, régression ou défaut identifié.
- ⚪ À FAIRE : fonctionnalité non construite.

> Un bloc peut être déclaré « validé » dans le registre tout en restant 🟡 à un niveau supérieur. Le statut doit toujours préciser exactement ce qui a été validé.

## 3. Fiche obligatoire

Chaque entrée doit renseigner, lorsque pertinent :

- ID unique
- Fonctionnalité / page
- Domaine
- Description
- Routes
- Fichiers créés/modifiés
- Tables / vues / fonctions / triggers DB
- Migration(s)
- Tests créés
- Tests exécutés et résultats
- Branche de création
- Commit(s) de création
- Intégration dans main et SHA correspondant
- Déploiement éventuel
- Validation statique
- Validation technique
- Validation fonctionnelle
- Validation Production
- Preuves
- Blocage éventuel
- Cause
- Correction appliquée
- Prochaine action
- Dernière vérification
- Notes / décisions / contradictions

## 4. Registre

| ID | Fonctionnalité | Domaine | Branche | Commit création | Main | Statut | Blocage / prochaine action |
|---|---|---|---|---|---|---|---|
| À compléter par audit | — | — | — | — | — | ⚪ | Inventaire exhaustif du dépôt requis |

## 5. Règle d'historique

Ne jamais supprimer silencieusement une information de suivi importante. Lorsqu'un statut évolue, conserver la trace de l'état précédent dans l'historique Git et, si nécessaire, dans l'entrée elle-même.

## 6. Règle de reprise inter-conversations

Avant toute nouvelle construction, l'IA doit :

1. Lire ce document.
2. Lire le cahier des charges maître.
3. Lire les documents de continuité pertinents.
4. Vérifier l'état réel de main, les commits et les fichiers concernés.
5. Identifier le dernier bloc traité et son statut.
6. Reprendre exactement au prochain bloc pertinent ou au bloc explicitement demandé.
7. Ne jamais déclarer une preuve non obtenue.
8. Ne jamais recommencer un chantier déjà consigné comme traité sans raison documentée.

## 7. Historique des mises à jour

| Date | Action | Commit | Auteur/agent |
|---|---|---|---|
| 2026-10-08 | Création du registre opérationnel | à renseigner après commit | NAXA AI workflow |
