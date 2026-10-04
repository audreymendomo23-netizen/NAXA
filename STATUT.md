# NAXA — STATUT

Mise à jour : 4 octobre 2026

## Phase 0
État : TERMINÉE — validée

- Prompt maître et cahier des charges examinés.
- Architecture et contraintes principales confirmées.
- Aucune réécriture de l'application.

## Phase 1 — Fondations
État : EN COURS

### Réalisé
- Projet Supabase NAXA : actif et sain.
- Schéma initial appliqué.
- Migration catalogue/panier appliquée.
- 9 tables publiques créées avec RLS.
- Seed de démonstration exécuté.
- pg_cron activé.
- Job naxa-expire planifié toutes les 5 minutes.
- Correction du typage Supabase SSR dans src/lib/supabase/server.ts.

### Reste à vérifier
- npm install.
- npm run build.
- Démarrage local avec npm run dev.
- Connexion par code e-mail.
- Recherche sur les données de démonstration.
- Vérification du parcours jusqu'à l'affichage des pharmacies.

### Déploiement
Aucun déploiement effectué. Le déploiement Vercel existant reste inchangé.

### Prochaine étape
Valider techniquement le build et le premier parcours local de Phase 1 avant de passer à la Phase 2.

## Gouvernance
- Développement sur le dépôt NAXA existant.
- Aucun nouveau dépôt créé.
- Aucun déploiement sans autorisation explicite.
- Les décisions du prompt maître et du cahier des charges restent prioritaires.