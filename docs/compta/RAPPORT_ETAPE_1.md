# Rapport d’étape 1 — Socle SQL Comptable NAXA

Date : 21 octobre 2026  
Branche : `main`  
Source normative unique : `docs/CAHIER_DES_CHARGES_COMPTE_COMPTABLE.md` — SHA `99700259f7da546fd68e01256a724a9395da1182`.  
Statut : **SOCLE SQL INTÉGRÉ ET TESTÉ SUR LA BASE DE TEST — NON APPLIQUÉ À LA BASE NAXA ACTIVE**.

## 1. Audit de cohérence avant construction

- Confirmé le schéma de profils et le modèle d’autorisation déjà présent : `profiles.fonction_interne`, `public.naxa_business_function(uuid)`, `public.naxa_scope_allows(uuid,uuid,text)`, `public.naxa_can(text,uuid,uuid)`.
- Confirmé que `MANAGE_ACCOUNTING` ne doit pas être assimilé à un droit général d’encaisser, modifier les ventes ou clôturer une caisse.
- Respecté le périmètre d’une pharmacie par RLS et contrôles serveur ; le Comptable doit être explicitement la fonction interne `comptable` et posséder le privilège actif sur la pharmacie.
- Réutilisé l’extension de hachage `extensions.digest`, déjà utilisée par les tests d’audit de caisse.
- La migration est additive ; aucune table métier existante n’a été modifiée. Aucun compte, taux de TVA, seuil, mapping fiscal ou plan de comptes SYSCOHADA n’est prérempli.

## 2. Fichiers ajoutés ou modifiés

- `supabase/migration_20261020_compta_socle.sql` — migration additive du socle.
- `supabase/tests/160_compta_socle.sql` — tests SQL transactionnels.
- `docs/compta/RAPPORT_ETAPE_1.md` — ce rapport.

Aucun écran frontend ou module métier existant n’a été modifié à cette étape.

## 3. Contenu du socle

- `compta_periodes` : périodes par pharmacie, avec verrouillage des périodes clôturées.
- `compta_parametre` : paramètres datés et explicitement validés ; aucun taux légal par défaut.
- `compta_plan_comptable` et `compta_mapping_compte` : comptes et mappings à renseigner/valider, sans hypothèse SYSCOHADA codée en dur.
- `compta_evenement` : outbox idempotente avec état, tentatives et prochaine tentative.
- `compta_ecriture` et `compta_ligne` : montants FCFA entiers en `bigint`, références de source et contre-passation ; contrainte différée de partie double.
- `compta_audit` et `compta_audit_tete` : chaîne SHA-256 séquencée et fonction `compta_verifier_audit(uuid)`.
- `compta_poster_ecriture(...)` : RPC de comptabilisation réservée au rôle serveur `service_role`, non exécutable par `anon` ou `authenticated`. La réutilisation d’une clé d’idempotence avec un contenu différent est refusée.
- RLS activée sur toutes les tables ; lecture Comptable bornée à la pharmacie et au privilège actif ; aucune mutation directe des écritures depuis le client ; journal append-only.

Le correctif du déclencheur différé a été appliqué après le premier test révélant une différence de structure entre ligne d’écriture et ligne de journal. Le test a ensuite été rejoué avec succès. Le RPC a ensuite été durci pour refuser une clé d’idempotence réutilisée avec des lignes ou métadonnées différentes ; la suite SQL a été rejouée une dernière fois avec succès.

## 4. Preuves de test

Base de test utilisée : projet Supabase `naxa-ci-replay-2`, référence `pwfftcsjyeibxxqhwysw`.  
La base NAXA active `Naxa` (`eouwtuusnsuxaejsxknf`) n’a pas été modifiée.

- **PASS** — rejet d’une écriture déséquilibrée.
- **PASS** — rejet d’une écriture sur période clôturée.
- **PASS** — unicité de la clé d’idempotence d’un événement.
- **PASS** — modification et suppression d’une écriture refusées.
- **PASS** — vérification de chaîne d’audit valide et détection d’une altération.
- **PASS** — aucun droit direct de mutation des écritures pour `authenticated`.
- **PASS** — fonction de comptabilisation non exécutable par `authenticated`.
- **PASS** — le rôle Caisse ne lit aucune écriture comptable via RLS.
- **PASS** — contrôle SQL post-migration des privilèges d’exécution des fonctions de trigger : aucune exécution par `anon` ou `authenticated`.

Commande exécutée : contenu de `supabase/tests/160_compta_socle.sql` envoyé à la base de test par le connecteur Supabase. Résultat renvoyé : `160_compta_socle PASS`. Les fixtures sont créées dans une transaction terminée par `ROLLBACK`.

Le contrôle Security Advisors a également été consulté. Il signale plusieurs alertes préexistantes sur des objets NAXA sans rapport direct avec ce chantier (dont une vue existante et des fonctions métier existantes). Les fonctions de déclencheur comptable initialement signalées ont été corrigées par révocation explicite des droits d’exécution ; une requête SQL a confirmé `anon_exec=false` et `authenticated_exec=false` pour ces fonctions.

## 5. Design convenu à préserver pour les écrans suivants

Cette étape étant uniquement SQL, elle ne crée pas encore d’interface. Les écrans Comptable devront reprendre le design NAXA convenu : mobile-first, police Inter, vert forêt et jaune canari, cartes arrondies, contraste/accessibilité AA, navigation desktop avec sidebar de 240 px et topbar de 64 px, navigation mobile en onglets bas. Les états vide, chargement, erreur, accès refusé et paramètre à valider seront explicites. **Aucune donnée de démonstration** ne sera affichée.

## 6. Limites et risques restants

- Migration exécutée et testée uniquement sur la base de test. Elle n’a pas été appliquée à la base NAXA active et aucun déploiement n’a eu lieu.
- Le test SQL couvre le socle, mais pas encore l’intégralité de la suite RLS inter-pharmacies, les RPC d’outbox, les événements métier ou les tests frontend.
- Le plan comptable, les mappings, la TVA et les paramètres légaux restent volontairement à renseigner/valider par une personne compétente.
- Aucun lint, typecheck, build, Vitest ou E2E n’a été lancé ; ces contrôles sont **NON EXÉCUTÉS** et aucune CI n’a été consultée.
- La chaîne d’audit a une primitive d’écriture côté serveur et un vérificateur ; les points d’intégration audit des actions de configuration et des événements opérationnels seront branchés dans les étapes suivantes.

## 7. Suite

Étape 2 : intégrer le moteur TypeScript `lib/compta/*` et ses tests unitaires, puis étendre les calculs et contrôles à partir des données réelles, sans taux, comptes ni montants fictifs. Le socle SQL de cette étape est prêt pour poursuivre sur `main`.
