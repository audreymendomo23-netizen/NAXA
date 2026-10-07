# NAXA — PROTOCOLE DE CONTINUITÉ

## Objet

Garantir qu'une nouvelle conversation reprend exactement le travail en cours au lieu de reconstruire le contexte ou de créer une branche concurrente.

## Contrat obligatoire de session

Avant toute recherche, modification, codage, migration ou réponse technique substantielle :

1. Lire `docs/NAXA_MASTER_INDEX.md`.
2. Lire `docs/NAXA_REPRISE_EXACTE.md`.
3. Lire `STATUT.md`.
4. Lire `README.md`.
5. Vérifier sur GitHub la branche déclarée et son SHA réel.
6. Comparer le SHA réel au checkpoint.
7. Contrôler les fichiers/migrations mentionnés par le checkpoint.
8. Reprendre uniquement au point indiqué par `exact_resume_point`.

## Règle de divergence

Si le SHA, la branche, les fichiers ou le résultat attendu diffèrent du checkpoint :

**STOP — PAS DE CODAGE.**

Il faut :
- isoler la divergence ;
- déterminer son origine ;
- établir l'état réel ;
- corriger le checkpoint ou le dépôt selon la preuve ;
- seulement ensuite reprendre.

## Règle de branche

La branche courante reste la branche de continuation.

Une nouvelle branche est interdite par défaut. Elle n'est créée que si une nécessité technique est démontrée et documentée dans le checkpoint.

## Règle de validation

Chaque unité de travail suit :

audit
→ contradiction
→ cause racine
→ correction
→ test/preuve
→ documentation
→ 🟢 VERT
→ arrêt
→ validation utilisateur.

Un état 🟡 ou 🔴 ne constitue jamais une validation.

## Checkpoint obligatoire

Après toute action significative, le checkpoint courant doit identifier :
- checkpoint_id ;
- branche ;
- SHA d'ancrage ;
- chantier ;
- partie ;
- étape ;
- sous-étape ;
- dernière action terminée ;
- résultat ;
- statut ;
- point exact de reprise ;
- première action suivante ;
- fichiers/migrations concernés ;
- validations/interdictions.

## Autorités

- Cahier des charges V3.7 = cible produit.
- Prompt maître Fusion = méthode.
- GitHub = réalité.
- Checkpoint = position exacte.
- STATUT = état synthétique.

## Interdictions permanentes

Ne jamais :
- inventer un état Git ;
- déclarer un test CI réussi sans preuve ;
- considérer une conversation comme source technique unique ;
- merger `main` sans autorisation ;
- déployer Production sans autorisation.
