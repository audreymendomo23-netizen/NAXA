# NAXA — Correction connexion pharmacie Preview (13 octobre 2026)

## Diagnostic prouvé

La route Vercel `POST /api/pharmacie/code` renvoyait `NAXA_RATE_LIMIT_UNAVAILABLE`. Les journaux Supabase/Vercel précisaient `Invalid API key`. La variable Preview de branche `SUPABASE_SERVICE_ROLE_KEY` était configurée comme secret vide : la route appelait donc Supabase avec une clé administrative absente/invalide. Il ne s'agissait pas d'un problème de code pharmacie.

Le projet de test `naxa-ci-replay-2` contient une pharmacie active `PHARMACIE TEST NAXA - HORS LIGNE`, avec le code de test `4827`.

## Correction appliquée sur le banc de test

- Ajout du RPC `naxa_validate_pharmacy_code_v1`, qui exécute le contrôle du code et le limiteur atomique côté base.
- Le RPC est réservé au rôle `service_role`; aucun accès anonyme n'est accordé.
- Déploiement de la fonction Edge `naxa-pharmacy-code` sur le projet Supabase de test. Elle utilise la clé administrative fournie par l'environnement Supabase, hache les clés de limitation côté serveur et ne journalise ni code ni clé.
- La route Next.js appelle cette fonction Edge au lieu d'utiliser la variable Vercel `SUPABASE_SERVICE_ROLE_KEY` manquante.
- Migrations ajoutées : `083_validate_pharmacy_code.sql` et `084_lockdown_pharmacy_code_rpc.sql`.

## Preuves et limites

- La fonction Edge du projet de test est active, version 2.
- Le RPC privé a répondu `status=ok` à un appel SQL de contrôle pour le code de test `4827`.
- La présence du code et le contrôle SQL sont confirmés. Le parcours HTTP Vercel complet doit être vérifié sur le prochain déploiement Preview.
- Aucun changement ni écriture sur Supabase Production; aucun merge et aucun déploiement Production.
