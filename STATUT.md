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

### Dernière évolution — accès client, compte et validation d'âge
- Scanner d’ordonnance : choix explicite entre import depuis le téléphone et utilisation de la caméra ; aucune image n’est envoyée par ce parcours OCR navigateur.
- Visiteur non connecté : recherche libre conservée ; les actions opérationnelles nécessitent une connexion.
- Les noms de médicaments du bandeau « Les plus recherchés » sont traduits en anglais pour les termes connus ; les cartes produit sont également soumises au contrôle d’accès.
- Le parcours d'inscription est désormais structuré en trois étapes : identité et téléphone, OTP e-mail, puis création du mot de passe.
- Nom et prénom sont sur la même ligne ; le nom d'utilisateur est unique, contrôlé en direct avec coche jaune canari / croix rouge, et devient l'identifiant de connexion.
- Aucun champ « nationalité » séparé : le drapeau sélectionné fournit le pays et l'indicatif téléphonique ; la longueur attendue du numéro est contrôlée côté interface et côté trigger Supabase.
- « Âge » est remplacé par « Date de naissance » ; les moins de 18 ans sont refusés avant création et la base marque les comptes validés avec age_verified=true.
- Les actions protégées et les routes opérationnelles exigent maintenant connexion + validation de l'âge pour les comptes client.
- Une page de validation d'âge existe pour les comptes client historiques dont l'âge n'était pas encore enregistré.
- La connexion n'utilise plus l'OTP : elle se fait par nom d'utilisateur + mot de passe, avec « Rester connecté », « Mot de passe oublié ? » sur la même ligne et une entrée Google/Gmail préparée.
- La récupération de mot de passe demande le nom d'utilisateur, envoie un OTP à l'e-mail associé, vérifie l'OTP côté serveur puis ouvre l'interface « Modifier mot de passe » avec les mêmes critères que l'inscription. Après mise à jour, retour à la connexion. La réponse reste non révélatrice pour éviter l'énumération des comptes.
- « Connexion via Gmail » affiche désormais l'icône Google ; le code OAuth est prêt mais le fournisseur Google doit être activé dans Supabase pour supprimer l'erreur « Unsupported provider ».
- « Les plus recherchés » est rendu uniquement sur la page d'accueil.
- La page d'inscription est verrouillée sans scroll de page et les trois documents de politique sont des liens individuels.
- Le traitement visuel <strong>NAXA</strong> est standardisé via `.naxa-text` (gras, +1px) hors logo.

### Prochaine étape
Vérifier le parcours complet en environnement de développement : inscription → OTP → mot de passe → connexion par nom d'utilisateur → récupération de mot de passe → blocage connexion/âge. La configuration Google/Gmail dans Supabase reste à confirmer si le fournisseur n'est pas encore activé.

## Gouvernance
- Développement sur le dépôt NAXA existant.
- Aucun nouveau dépôt créé.
- Aucun déploiement manuel sans autorisation explicite.
- Les décisions du prompt maître et du cahier des charges restent prioritaires.
