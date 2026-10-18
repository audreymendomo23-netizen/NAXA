# Étape canonique 5 — « Besoin d’aide ? » phase 1
Date : 19 octobre 2026

## Implémentation sur main
- La route `/aide` propose un chat écrit gratuit avec une pharmacie active et visible du répertoire, réservé aux clients connectés.
- La route `/pharmacie/aide` fournit la boîte de réception et permet à un compte rattaché à la pharmacie choisie de répondre.
- Réutilisation des tables existantes `tickets_support` et `messages_support`, avec ouverture atomique du ticket et du premier message via `open_pharmacist_chat`.
- RLS pour création des tickets, insertion des messages et lecture des conversations ; la sélection des messages masque les notes internes aux non-administrateurs.
- Limite de 2 000 caractères par message et filtrage des pharmacies inactives, invisibles ou archivées.
- L’heure de première réponse est enregistrée côté serveur.
- L’interface avertit que les réponses ne sont ni instantanées ni garanties 24 h/24, que le chat ne remplace pas un examen et qu’une urgence ne doit pas attendre une réponse.
- Aucun numéro d’urgence non vérifié n’est présenté comme universel au Cameroun. Aucune téléconsultation, aucun diagnostic ni aucune posologie personnalisée ne sont ajoutés.

## Migration et preuves SQL
- Migration `132_aide_pharmacien_chat` appliquée sur le projet de test `naxa-ci-replay-2` et Supabase Production.
- Test `naxa_132_aide_pharmacien_chat_pass = true` sur les deux projets.
- Contrôles confirmés : RPC en privilèges invoker, exécution refusée à `anon`, accordée à `authenticated`, politiques d’insertion présentes, RLS activé et filtrage des notes internes.

## Limites restant à vérifier
- Le build Next.js et les parcours navigateur n’ont pas été exécutés dans cette session.
- Pas de test physique en conditions réelles, ni de garantie de présence d’un pharmacien connecté au moment de l’envoi.
- Pas de liste d’hôpitaux « ouverts maintenant » sans source fiable et actualisée.
- Pas de déploiement Vercel déclenché manuellement dans le cadre de cette étape.
