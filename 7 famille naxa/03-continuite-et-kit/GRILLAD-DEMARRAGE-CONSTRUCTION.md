# GrillaD — Démarrage de la construction

> Version 0.1 · 14 novembre 2026  
> État : cadrage technique initial établi ; implémentation applicative non commencée.

## 1. Décisions métier de référence

Le cahier des charges GrillaD v1.2 et le dossier de prompts v1.1 font autorité.

GrillaD doit fonctionner dans trois modes, sur un même modèle :
1. Manager autonome exploitant lui-même son activité sur un lieu physique précis, sans vendeur obligatoire.
2. Manager supervisant un vendeur affecté à un lieu physique précis.
3. Manager supervisant plusieurs vendeurs affectés à plusieurs lieux physiques précis.

Chaque lieu est créé, identifié, décrit et géolocalisé avant exploitation. Chaque session, présence, vente, stock, caisse, dépense et rapport est rattaché à un lieu. Les droits sont limités aux affectations. Le Manager peut être opérateur dans les trois modes. Les lieux, stocks, caisses et historiques restent séparés.

Catalogue fermé : porc braisé, poulet braisé, poisson braisé, brochettes, omelettes.

## 2. Audit initial du dépôt actuellement connecté

Dépôt inspecté : `audreymendomo23-netizen/NAXA`, branche `main`. HEAD observé pendant l'audit : `a6849183b88ff33f7cb4dd9eca327af410a368ec`.

Preuves obtenues depuis l'arborescence et les fichiers :
- Le dépôt contient l'application NAXA existante (Next.js, React, TypeScript) à la racine.
- `package.json` identifie le projet comme `naxa` et déclare Next.js 16.4.6, React 18.3.1, TypeScript 5.6.2 et Supabase JS 2.45.4.
- `android/settings.gradle.kts` déclare un projet Android nommé `NAXA` avec un seul module `:app`.
- `android/app/build.gradle.kts` utilise Kotlin, Jetpack Compose, namespace/applicationId `cm.naxa.app`, minSdk 26 et compileSdk 35.
- `android/README.md` confirme une application Android native Kotlin/Jetpack Compose et documente les fonctions NAXA déjà présentes.
- Le dépôt contient aussi `android/payment-companion`, qui est un compagnon de vérification de paiement NAXA.
- L'arborescence Supabase contient les migrations de l'application NAXA.
- Aucune application/module GrillaD autonome n'a été identifié dans les chemins Android examinés.

## 3. Conséquence d'architecture

Le dépôt NAXA existant ne doit pas être transformé en monorepo Famille NAXA ni recevoir le code applicatif GrillaD. Cela évite de mélanger le cycle de vie, les permissions, les identifiants Android, les versions et les responsabilités de livraison de NAXA avec ceux de GrillaD.

Les composants NAXA ne seront réutilisés qu'après audit ciblé et preuve de compatibilité. Le partage du backend Supabase NAXA Production reste une cible d'architecture, pas une autorisation de modifier la Production. Les migrations devront être conçues de façon additive, testées dans l'environnement Replay autorisé, puis soumises à un contrôle séparé avant toute opération Production.

## 4. Socle technique à confirmer dans le dépôt GrillaD dédié

Proposition technique, non encore implémentée :
- Android autonome : Kotlin + Jetpack Compose.
- Backend : Supabase/PostgreSQL, RLS et fonctions serveur ; aucune clé service_role côté client.
- Web/PWA : à intégrer seulement si le périmètre de livraison GrillaD le prévoit et si le dépôt dédié adopte ce socle.
- Synchronisation hors connexion : identifiants idempotents, journal d'événements, reprise contrôlée et conflits explicites.
- Géolocalisation : permission Android explicite, service uniquement, lieu attendu connu, précision et horodatage conservés.
- Monnaie : FCFA et types monétaires exacts.

## 5. Première tranche de construction à réaliser dans le dépôt dédié

**GD-0 — audit ciblé du socle**  
Inventorier les composants réellement réutilisables, les versions, la structure de build, les conventions de test et les contraintes de sécurité.

**GD-1 — fondation du domaine organisationnel**  
Concevoir et tester les entités minimales : organisation, Manager, lieu physique géolocalisé, affectation datée, session de service et présence. Relier explicitement les trois modes au même modèle. Ne pas ajouter encore les modules de vente/stock tant que l'isolation des lieux et les affectations ne sont pas prouvées.

**GD-2 — sécurité et autorisations**  
Tester les accès Manager et vendeur, les limites par organisation/lieu, les affectations expirées/révoquées et les opérations sensibles.

**Critères de sortie de cette première tranche**
- Le Manager peut ouvrir une activité sans compte vendeur.
- Un vendeur ne peut travailler que sur un lieu auquel il est affecté.
- Un Manager peut superviser un vendeur sur un lieu et plusieurs vendeurs sur plusieurs lieux.
- Les écritures et sessions restent isolées par lieu.
- Les changements de mode et d'affectation ne détruisent aucun historique.
- Les tests négatifs prouvent l'absence d'accès inter-organisation et inter-lieu non autorisé.

## 6. Limite actuelle et action de reprise

L'accès GitHub disponible permet de lire et modifier les fichiers du dépôt connecté, mais ne fournit pas d'action de création d'un nouveau dépôt GitHub. La création du dépôt dédié GrillaD/Famille NAXA est donc le seul prérequis externe avant d'écrire et compiler le code applicatif sans enfreindre la séparation des dépôts.

Aucun code applicatif GrillaD n'a été ajouté au dépôt NAXA existant. Aucune migration Supabase n'a été exécutée. Aucun déploiement ni publication APK n'a été déclenché.

## 7. État de preuve

| Élément | État |
|---|---|
| Cahier GrillaD v1.2 publié | Vérifié par commit GitHub |
| Prompts GrillaD v1.1 publiés | Vérifié par commit GitHub |
| Audit initial du dépôt existant | Effectué sur l'arborescence et les fichiers cités |
| Module Android GrillaD | Non créé |
| Modèle de données GrillaD | Non créé |
| Migrations GrillaD | Non créées / non appliquées |
| Tests applicatifs GrillaD | Non exécutés |
| Build APK GrillaD | Non réalisé |
| Déploiement / Production | Non effectué |

Conclusion : **cadrage et audit initial terminés ; construction applicative en attente du dépôt dédié**.
