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
- Migration 003 de durcissement sécurité/performance appliquée.
- 9 tables publiques créées avec RLS.
- Seed de démonstration exécuté.
- pg_cron activé.
- Job naxa-expire planifié toutes les 5 minutes.
- Correction du typage Supabase SSR dans src/lib/supabase/server.ts et src/middleware.ts.
- Correction de la page panier : structure JSX/TypeScript fermée et reformattée.
- Ajout du composant d'import de stock administrateur manquant référencé par /admin.
- Audit 360° du code, des contraintes RLS/fonctions et de la cohérence entre dépôt et base.
- Correction de la source schema.sql : fonction produits_norm, politique d'écriture produit et validations serveur du panier.
- Correction de migration_002_catalogue_panier.sql : syntaxe des policies.
- Ajout de migration_003_security_hardening.sql pour rendre le durcissement reproductible.
- Renforcement des fonctions sensibles et retrait des exécutions publiques inutiles.
- Ajout des index FK utiles pour anticiper la montée en charge.
- Import stock adapté au nouveau contrôle d'écriture des fiches produits.

### Contradictions détectées et corrigées
1. Le dépôt SQL ne reproduisait pas exactement le SQL qui avait permis de créer la base : produits_norm() était syntaxiquement incomplet.
2. migration_002_catalogue_panier.sql contenait create policy if not exists, non valide dans PostgreSQL pour cette forme.
3. Une pharmacie pouvait théoriquement modifier n'importe quelle fiche produit via la policy RLS ; l'update produit est désormais réservé à l'administration.
4. Le RPC reserve_stock pouvait recevoir des quantités hors des limites UI ; les limites sont maintenant contrôlées côté serveur.
5. restore_stock et expire_reservations n'avaient pas besoin d'être exécutables par les clients ; leurs droits Data API sont retirés.
6. La recherche de dépendances FK et certaines policies étaient insuffisamment préparées pour la montée en charge ; index et initplans RLS ont été renforcés.
7. Le build Vercel avait révélé une série d'erreurs TypeScript ; le middleware a été inspecté à son tour pour éliminer le même motif d'implicit any.

### État de vérification
- Supabase : migrations, fonctions et policies modifiées et vérifiées par requêtes SQL.
- Security/Performance Advisor : les alertes restantes sont en partie intentionnelles (fonctions publiques nécessaires à la recherche/bandeau, fonctions d'autorisation utilisées par RLS, extensions historiques en public) ; aucune correction destructive appliquée.
- Vercel : un nouveau build est automatiquement déclenché par les commits sur main ; il doit encore être confirmé READY.
- Parcours local complet, connexion e-mail et parcours recherche→pharmacie restent à valider.

### Déploiement
Aucun déploiement manuel effectué. Les pushes sur main déclenchent uniquement le mécanisme Vercel déjà configuré.

### Dernière évolution — accès client et ordonnance
- Scanner d'ordonnance : choix explicite entre import depuis le téléphone et utilisation de la caméra ; aucune image n'est envoyée par ce parcours OCR navigateur.
- Visiteur non connecté : recherche libre conservée ; les actions opérationnelles sont maintenant protégées par une interface de connexion puis de vérification d'âge.
- Vérification d'âge : ajout du champ `profiles.age_verified`, de l'écran `/verification-age` et de la migration `migration_005_age_verification.sql`. La migration reste à appliquer/vérifier sur Supabase avant de considérer cette partie comme active en production.
- Bandeau « Les plus recherchés » : noms de médicaments traduits en anglais pour les termes connus ; les cartes produit sont également soumises au contrôle d'accès.

### Prochaine étape
Vérifier le build de la branche de travail et appliquer/tester la migration 005 uniquement après validation explicite.

## Gouvernance
- Développement sur le dépôt NAXA existant.
- Aucun nouveau dépôt créé.
- Aucun déploiement manuel sans autorisation explicite.
- Les décisions du prompt maître et du cahier des charges restent prioritaires.
