# Étape canonique 5 — « Besoin d’aide ? » phase 1
Date : 19 octobre 2026

## Périmètre réalisé sur main
- Réutilisation des tables existantes `tickets_support` et `messages_support`.
- Chat gratuit initié par un client connecté, vers une pharmacie active et visible choisie dans le répertoire.
- Réponses limitées au compte pharmacie rattaché à la pharmacie sélectionnée.
- Messages de chat publics uniquement, avec limite de 2 000 caractères, sans exposition des notes internes.
- RLS serveur pour l’ouverture des tickets et l’insertion des messages ; horodatage de la première réponse pharmacie.
- Rappel visible : ce canal n’est pas un service d’urgence et ne remplace pas une consultation. Aucune téléconsultation ni diagnostic n’est ajouté.
- Ressources d’urgence : le client est invité à contacter directement les services locaux. Aucun numéro non vérifié n’est présenté comme universel au Cameroun.

## Limites à conserver
- Les réponses ne sont pas garanties instantanées ; la disponibilité réelle dépend d’une pharmacie connectée.
- Pas de promesse de permanence 24/7.
- Pas de liste d’hôpitaux « ouverts maintenant » sans source actualisée fiable.
- Le chat ne doit pas collecter inutilement des données de santé ; ne pas y envoyer une urgence.

## Validation
La migration 132 doit être appliquée et les tests SQL exécutés sur le projet de test et Production. Le build et le parcours navigateur doivent être distingués de ces contrôles SQL. Aucun déploiement Vercel n’est inclus dans cette étape.
