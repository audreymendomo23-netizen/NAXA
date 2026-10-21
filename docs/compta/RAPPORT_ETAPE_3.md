# Rapport d’étape 3 — Outbox métier Comptable

Date : 21 octobre 2026  
Branche : `main`  
Source normative : `docs/CAHIER_DES_CHARGES_COMPTE_COMPTABLE.md`  
Statut : **SOCLE OUTBOX INTÉGRÉ AU DÉPÔT — MIGRATION ET TEST SQL NON EXÉCUTÉS SUR UNE BASE LOCALE/ACTIVE — WORKER DE COMPTABILISATION À POURSUIVRE**.

## Changements enregistrés

- `supabase/migration_20261021_compta_outbox.sql`
  - Ajoute un état de file `en_cours`, un jeton de réclamation et un bail de 5 minutes.
  - Émet un événement idempotent quand une vente passe à `payee`, et quand une dépense passe à `validee`.
  - N’insère dans le payload que le montant FCFA, la date comptable et une référence source. Aucun identifiant patient, détail de ligne de vente ou donnée clinique n’est copié.
  - Expose les RPC de réclamation et de finalisation uniquement à `service_role`.
  - Protège la file contre le traitement concurrent via `FOR UPDATE SKIP LOCKED` et un jeton de réclamation.
  - Refuse de marquer un événement `traite` si aucune écriture comptable correspondante (même pharmacie, source et clé d’idempotence) n’existe.
  - Après un échec, programme une nouvelle tentative à 15 minutes ; après 8 tentatives, l’événement passe à `erreur`. Le code d’erreur stocké est réduit à un identifiant technique borné, pas au message brut d’une exception.
- `supabase/tests/161_compta_outbox.sql`
  - Vérifie la présence des deux triggers, l’état `en_cours` et les privilèges des RPC.
  - Le test s’exécute dans une transaction et se termine par rollback.

## Limites explicites

- Le traitement des mappings, de la période et de la partie double a depuis été ajouté dans `supabase/migration_20261022_compta_worker.sql`, avec un appelant Edge Function dans `supabase/functions/compta-worker/index.ts`. Voir le rapport d’étape 4 pour le détail et les limites de validation.
- Les événements d’annulation/retour, réception fournisseur, pertes/péremptions, mouvements de stock, clôture de caisse, paie et immobilisations ne sont pas émis ici. Ils exigent d’abord une source validée et une règle de valorisation/mapping confirmée ; aucune table ou valeur fiscale n’a été inventée.
- La migration et le test SQL n’ont pas été appliqués à la base Supabase active.
- Les tests TypeScript de l’étape 2 et le typecheck du dépôt n’ont pas pu être exécutés dans l’environnement local disponible : le clone NAXA n’est pas présent et l’accès réseau à `github.com` échoue avec `Could not resolve host: github.com`. La tentative `npm run test:compta-moteur` échoue donc faute de `/package.json`; `tsc --noEmit` affiche l’aide car aucun `tsconfig.json` local n’est présent. Ce ne sont pas des échecs du moteur : l’exécution reste non vérifiée.

## Sécurité et déploiement

Aucune donnée de démonstration ajoutée. Aucune migration appliquée à la base active. Aucun déploiement, build ou pipeline CI lancé.
