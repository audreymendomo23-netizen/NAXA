

## N4 — Replay SQL / architecture des dépendances — 08/10/2026
- HEAD audité : bf683ffb9ec6e810b418096ef87c6881a7a44882.
- Qualité CI : 🟢 ; replay SQL : 🔴 sur le dernier run connu.
- Cause architecturale traitée : migration_020_architecture_privileges.sql exécutait des GRANT/REVOKE sur des fonctions d'autorisation avant leur définition réelle, dont naxa_can, naxa_business_function et deux anciens noms inexistants (naxa_assign_privilege, naxa_revoke_privilege).
- Correction : suppression de ces opérations prématurées ; les droits sont appliqués dans les migrations qui définissent effectivement les fonctions.
- Garde CI ajoutée : tout GRANT/REVOKE ON FUNCTION doit rencontrer sa définition avant son utilisation dans l'ordre de replay ; un nom de fonction inconnu est également bloquant.
- Test structurel ajouté : supabase/tests/020_architecture_authorization_dependencies.sql.
- Aucun merge vers main, aucun déploiement Production et aucune validation Supabase live effectués.
- État N4 : 🟡 — nouvelle preuve CI complète requise avant passage au vert.
[object Object]

## ERP-008 — Socle assurances / tiers payant
- Audit sans doublon : aucun socle assurance détecté.
- Construction : assureurs, couvertures client, dossiers de prise en charge liés à la pharmacie et optionnellement à une vente.
- Les intégrations externes et règles de remboursement restent volontairement hors périmètre tant qu'aucun partenaire/scope n'est arbitré.
- Test structurel : `supabase/tests/049_assurances.sql`.
- Aucun changement Production.
- **État : 🟡 construit dans `main` — preuve SQL/CI manquante.**


## ERP-009 — Trésorerie / dépenses (F66)
- Audit sans doublon : aucun socle trésorerie/dépenses trouvé dans `main`.
- Construction : comptes de trésorerie XAF, catégories, dépenses en brouillon/validées/annulées et journal des mouvements.
- Sécurité : RLS + RPC ; aucune écriture directe authentifiée sur les dépenses/mouvements.
- Correction post-audit : clé composite `(id, pharmacie_id)` ajoutée pour sécuriser les références de compte par pharmacie.
- Validation d'une dépense génère un décaissement unique dans le journal.
- Aucun changement Production/Supabase live.
- **État : 🟡 construit dans `main` — preuve SQL/CI manquante.**


## ERP-010 — Fiche client / crédit (F68)
- Audit sans doublon : aucune fiche client commerciale/crédit existante dans `main`.
- Construction : fiche commerciale, plafond et solde de crédit, journal des opérations, demandes de dépassement et décision Promoteur/NAXA.
- Le crédit est raccordé au mode de paiement POS `credit`, sans second moteur de vente.
- **État : 🟡 construit dans `main` — preuve SQL/CI manquante.**

## ERP-011 — Rappel de lot (F64)
- Audit sans doublon : aucune implémentation concurrente de rappel de lot trouvée dans `main`.
- Construction : table `rappels_lots`, traçabilité du motif/référence/statut et RPC de rappel/levée.
- Le rappel actif bloque le lot canonique `stocks_lots`.
- RLS et exécution RPC limitées au périmètre pharmacie.
- Le POS n'étant pas encore lotisé, le blocage de vente au niveau d'un lot précis reste une dépendance du futur raccordement vente/FEFO.
- Migration : `supabase/migration_055_rappel_lot.sql`.
- Test structurel : `supabase/tests/052_rappel_lot.sql`.
- Aucun changement Production.
- **État : 🟡 construit dans `main` — preuve SQL/CI manquante.**


## ERP-012 — Offline ERP avancé — chantier du 08/10/2026
- Audit historique réconcilié : le offline stock existait déjà dans `main` via IndexedDB, file locale, détection réseau, synchronisation et résolution de conflits.
- Le manque identifié concernait l'idempotence côté serveur : un replay devait être rejouable sans risque de double mutation.
- Ajout : `supabase/migration_056_offline_idempotence.sql` + `supabase/tests/053_offline_idempotence.sql`.
- `src/app/pharmacie/page.tsx` utilise maintenant une clé d'opération UUID et la RPC `offline_stock_set_quantity()` pour les écritures online/offline.
- Aucun second moteur de stock ni second mécanisme offline créé.
- Aucun changement Production/Supabase live.
- **État : 🟡 construit dans `main` — preuve SQL/CI manquante.**


## ERP-003 — POS étape 1 — 08/10/2026
- Lignes de vente + allocation FEFO ajoutées au socle POS existant.
- État : 🟡 construit, preuve SQL/CI manquante.


## ERP-003 — POS étape 2 — 08/10/2026
- Paiements POS simples ou mixtes et finalisation atomique ajoutés au moteur de vente existant.
- Référence Mobile Money obligatoire ; paiement exact du total net requis.
- Aucun second moteur de vente créé.
- Aucun changement Production/Supabase live.
- **État : 🟡 construit — preuve SQL/CI manquante.**


## ERP-003 — POS étape 3 — ticket/reçu + numérotation unique — 08/10/2026
- Audit : aucun moteur concurrent de ticket POS/numéro de vente/réimpression trouvé ; le reçu de réservation existant reste inchangé.
- Construction additive : `ventes.numero_vente`, séquence unique, index unique et RPC `vente_ticket()` en lecture sécurisée.
- Les ventes historiques sont numérotées avant contrainte `NOT NULL` ; les nouvelles ventes reçoivent automatiquement un numéro.
- La RPC ticket est `SECURITY INVOKER` et s'appuie sur le scope existant des ventes/lignes.
- Aucun changement Production/Supabase live.
- **État : 🟡 construit — preuve SQL/CI manquante.**


## ERP-003 — POS étapes 4/5/6 — 08/10/2026
- Étape 4 : annulation contrôlée avec restitution stock/lot.
- Étape 5 : demande + décision séparées, décision Promoteur/NAXA et interdiction d'auto-approbation.
- Étape 6 : clôture Z avec fond initial, espèces, paiements mixtes, comptage et écart ; sessions historiques réouvrables grâce à l'index partiel des sessions ouvertes.
- Migrations/tests : `supabase/migration_060_pos_annulation_z.sql`, `supabase/tests/057_pos_annulation_z.sql`.
- Aucun changement Supabase live/Production.
- **État : 🟡 construit — preuve SQL/CI manquante.**


## ERP-003 — POS étapes 7/8/9 — 08/10/2026
- Paiements avancés : voucher, assurance/tier payant et crédit réconcilié avec le flux unique `vente_paiements`.
- Caisse rapide : favoris, paniers en attente/reprise et affichage client par session.
- Remises/promotions : bornes, période, plafond et approbation séparée.
- Migrations/tests : `supabase/migration_061_pos_avance_rapide_remises.sql`, `supabase/migration_062_pos_creation_vouchers_promotions.sql`, `supabase/tests/058_pos_avance_rapide_remises.sql`.
- Aucun changement Supabase live/Production.
- **État : 🟡 construit — preuve SQL/CI manquante.**

## Vérification finale ERP-010/011/012 — 08/10/2026
- ERP-010 : raccordement crédit → `vente_paiements` verrouillé par test structurel.
- ERP-011 : RPC rappel durcies avec `search_path=''`.
- ERP-012 : mutation directe de l'état offline interdite ; état serveur géré par RPC sécurisée avec contrôle de pharmacie.
- POS étape 7 : voucher consommé uniquement lors de la finalisation ; syntaxe assurance corrigée.
- Preuve live Supabase : indisponible actuellement (`link_id must identify an eligible linked account`).
- Preuve CI : aucun run associé au dernier commit.
- **État : 🟡 construit / preuve d'exécution SQL-CI manquante.**


## ERP-003 / Pharmacien — chantier du 08/10/2026
- Ajout du parcours Caisse : scan code-barres, recherche prix, bulk lookup, montant perçu, monnaie rendue, paiement et impression ticket.
- Ajout de `stocks.emplacement` par pharmacie.
- Intégration de la fonction interne `pharmacien` et du parcours de validation des ordonnances.
- Migrations/tests : `supabase/migration_063_caisse_pharmacien_barcode.sql`, `supabase/tests/059_caisse_pharmacien_barcode.sql`.
- Logos officiels Orange Money / MTN MoMo : assets officiels à intégrer ; aucun logo de substitution/redessiné.
- Aucun changement Supabase live/Production.
- **État : 🟡 construit sur `rewrite/naxa-from-main-20261007` — preuve SQL/CI manquante ; intégration `main` non démontrée.**


## Niveau 1 — Documentation / traçabilité — 08/10/2026
### Audit par contradiction
- **Contradiction :** plusieurs documents prescrits par le prompt maître étaient absents ou contenaient des références de reprise devenues obsolètes.
- **Cause racine :** historique documentaire conservé sans couche de référence courante explicite.
- **Correction :** création/mise à jour de `docs/CONTINUITE_NAXA.md`, `docs/FUSION.md`, `CONTRADICTIONS.md`, `docs/CAHIER_DES_CHARGES.md` et ajout d'une section de supersession dans le présent statut.
- **Preuve :** fichiers présents dans la branche de travail et références SHA consignées.
- **Distinction importante :** ce vert concerne uniquement la documentation/traçabilité. Les fonctionnalités métier encore 🟡 restent 🟡.
- **État : 🟢 NIVEAU 1 — DOCUMENTATION / TRAÇABILITÉ CORRIGÉ.**


## Niveau 2 — Git / structure / historique — 08/10/2026
### Audit par contradiction
- **Contradiction 1 :** plusieurs branches/PR historiques pouvaient être confondues avec le chantier courant.
- **Correction :** branche de travail explicitement désignée ; PR historiques obsolètes fermées sans suppression des commits ; PR #30 : fermée sans merge après obtention de la preuve CI CircleCI.nservée comme unique PR active du chantier Qualité.
- **Contradiction 2 :** deux migrations `064` et deux tests `060` existaient.
- **Correction :** renumérotation du Pharmacien en migration `065` et test `061`, références documentaires alignées.
- **Contradiction 3 :** PR #33/#34 reproduisaient des contenus déjà présents sur la branche courante.
- **Correction :** PR fermées, contenu conservé sur le chantier courant.
- **Preuve :** inventaire des branches, inventaire des PR ouvertes et contrôle des SHA de fichiers.
- **État : 🟢 NIVEAU 2 — GIT / STRUCTURE / HISTORIQUE CORRIGÉ.**

> Ce vert ne signifie pas que `main` a été modifié. `main` reste protégé ; aucune fusion ni Production n'a été effectuée.


# NIVEAU 3 — QUALITÉ TECHNIQUE ÉLÉMENTAIRE — 08/10/2026

## Corrections effectuées
- Script lint rendu exécutable de manière déterministe par ajout d'ESLint et de la configuration Next.
- Versions npm figées dans `package.json`.
- Gate qualité étendu au lint et activé sur la branche de chantier pour permettre une preuve CI réelle.

## Contrôles
- TypeScript : non prouvé par une exécution CI réelle à ce stade.
- Lint : non prouvé par une exécution CI réelle à ce stade.
- Build : non prouvé par une exécution CI réelle à ce stade.
- Reproductibilité npm : non complète tant que `package-lock.json` n'est pas versionné.
- Aucun merge vers `main`, aucun déploiement Production.

**Statut Niveau 3 : 🔴 — CORRECTIONS STATIQUES EFFECTUÉES, PREUVE D'EXÉCUTION MANQUANTE.**


## Niveau 4 — Tests
Le chantier Tests est ouvert.

### Audit
- Tests SQL présents : supabase/tests/017... jusqu'aux tests récents Caisse/Pharmacien 059, 060, 061.
- Le gate qualité historique ne les exécutait pas.
- Un job CircleCI sql_tests a été ajouté pour démarrer Supabase localement, rejouer le schéma + migrations et exécuter tous les tests SQL.

### Preuve
Aucune exécution du nouveau job n'est actuellement remontée pour le commit dfc58961fc2f55d501ac7c52ef95b44327258e6a. Le Niveau 4 ne peut donc pas être déclaré vert.

### Blocages
1. Pas de runtime Docker dans l'environnement d'exécution actuel.
2. Connecteur Supabase distant bloqué par « link_id must identify an eligible linked account ».
3. Le harnais doit encore garantir qu'un test SQL qui produit pass = false échoue réellement.

Statut Niveau 4 : 🔴 À CORRIGER — tests non prouvés.


## AUDIT BULK N4–N15 — 08/10/2026

Les niveaux 4 à 15 sont désormais traités simultanément par cause commune, et non comme quinze chantiers indépendants.

**Cause commune retenue :** absence d'un environnement de validation reproductible aligné exactement sur le HEAD de la branche, permettant de rejouer le schéma + toutes les migrations + tous les tests et de produire une preuve exploitable.

**Correction déjà engagée :** CircleCI `sql_tests` avec Supabase local et replay complet ; assertions SQL rendues bloquantes ; aucun changement de `main` ni de Production.

**Important :** l'accès Supabase distant fonctionne désormais. Le problème actuel est la divergence entre son état live et les migrations de la branche, et non un problème de connexion.

### Matrice bulk
- N4 Tests → preuve SQL reproductible
- N5 CI → exécution du gate et logs
- N6 DB → replay schéma/migrations/RLS/RPC
- N7 Métier → assertions métier sur le même replay
- N8 Intégrations → contrats/flux sur le même artefact
- N9 Sécurité/architecture → contrôles positifs et négatifs
- N10 Auth/sessions → tests identité/session
- N11 UI/UX → artefact + recette
- N12 Services externes → configuration/contrats sans souscription payante
- N13 Déploiement → validation avant autorisation Production
- N14 Robustesse → régression/performance
- N15 Conformité → croisement cahier v3.7 et preuves cumulées

**Statut bulk N4–N15 : 🔴 un seul problème commun résiduel — preuve d'exécution reproductible au HEAD manquante.**


## CORRECTION DE CONTINUITÉ — 08/10/2026

Le bloc historique indiquant que la preuve Supabase était indisponible par erreur de liaison et que le Niveau 3 était encore rouge est désormais **historique**.

- Accès Supabase NAXA : rétabli et vérifié.
- HEAD réel de la branche : `788a82b300db1a1862d39780dd901dc7c44573d9`.
- `main` : `2e96930c5d8fb0de4ad22cf4f3dd8dd95b4fd471`.
- Niveau 3 : 🟢 preuve CircleCI réelle déjà obtenue sur `f1fcd801f37989bdd17e667a0e88c17dd3e5f4e6`.
- Niveau 4–15 : le seul résiduel est la preuve d'exécution reproductible au HEAD courant.

Aucune modification de `main` ni de Production n'est autorisée par cette correction.


## CIRCLECI — REPRISE DU GATE SQL — 08/10/2026

- Connexion CircleCI : 🟢 existante et déjà utilisée sur NAXA.
- Configuration actuelle : `.circleci/config.yml`.
- Job `quality` : preuve historique 🟢 sur CircleCI.
- Job `sql_tests` : présent, mais aucune preuve d'exécution au HEAD actuel n'est encore disponible.
- GitHub Actions est actuellement bloqué **avant démarrage des jobs** par la limite de facturation/spending limit du compte ; ce blocage est externe au code NAXA.
- Aucun changement de code fonctionnel n'est introduit pour contourner ce blocage.
- Aucun merge vers `main`, aucun déploiement Production.

**Action en cours :** déclencher une nouvelle exécution CircleCI via une mise à jour documentaire minimale afin d'obtenir la preuve réelle du job `sql_tests`.


## REPRISE CI — CORRECTION CIRCLECI — 08/10/2026

- HEAD branche : `a415325bb6263568935b18d4919ea7d81d7bed3c3` (correction du parseur CircleCI heredoc).
- Correction : `.circleci/config.yml` utilise désormais le heredoc échappé \\<<'EOF' exigé par CircleCI v2.1.
- OpenAI/Chunk : hors chemin critique ; son exécution précédente s'est arrêtée sur `Budget Exceeded`, sans correction exploitable.
- Validation attendue : un nouveau run CircleCI `quality_and_tests`, avec `quality` puis `sql_tests`.
- Aucun changement de `main` et aucune modification Production.
- Statut N4–N15 : 🟡 EN ATTENTE DE PREUVE CI AU HEAD COURANT ; aucun vert déclaré sans résultat réel.


## CORRECTION CI / REPLAY SUPABASE — 08/10/2026
- Audit du feedback CircleCI : le blocage venait de deux défauts conjoints du harnais de validation, pas des fonctionnalités métier : noms de migrations générés au mauvais format et schéma base.sql avec des délimiteurs PL/pgSQL invalides.
- Correction appliquée sur rewrite/naxa-from-main-20261007 : timestamp Supabase conforme + underscore, exclusions CLI conformes, délimiteurs PL/pgSQL corrigés dans supabase/schema.sql.
- Aucun changement main / Production.
- Statut : 🟡 correction appliquée ; passage au vert uniquement après nouveau run CircleCI réussi.


## PREUVE FINALE — CI / REPLAY SUPABASE — 08/10/2026
- CircleCI run 192 a terminé avec `success` sur le HEAD `7c5155ce5fd3417e882be2523dfd0ce29f2ed0d6`.
- Le retour GitHub associé indique : « Your tests passed on CircleCI! ».
- Le défaut des noms de migrations et les délimiteurs PL/pgSQL du schéma ont été corrigés avant cette exécution.
- Niveau CI/replay concerné : 🟢 VALIDÉ.
- Aucun merge vers main et aucun déploiement Production.


# RECTIFICATION DE CONTINUITÉ — 08/10/2026 — HEAD COURANT

Cette section est la référence courante et supersède les références SHA antérieures présentes dans l'historique.

- Branche : `rewrite/naxa-from-main-20261007`
- HEAD vérifié : `5b24b96098ed240ddb9ade154e22f66969faa2df`
- main vérifié : `2e96930c5d8fb0de4ad22cf4f3dd8dd95b4fd471`
- Git : **behind = 0**, branche ahead de main ; merge-base = main HEAD.
- PR #30 : **ouverte / draft / non fusionnée**.
- Aucun merge main et aucune Production.
- Les SHA antérieurs consignés dans les sections historiques ne représentent plus le HEAD courant.
- La preuve CircleCI run 192 sur `7c5155ce...` reste une preuve historique et ne valide pas automatiquement `5b24b960...`.

## N4–N15 — position courante

Le gate bulk N4–N15 doit être rejoué et prouvé au HEAD `5b24b960...`. Aucun vert supplémentaire n'est déclaré avant cette preuve.

**N1–N3 : état documentaire et preuves historiques conservés ; N4–N15 : 🟡 en attente de preuve au HEAD courant.**


# N4 — AUDIT ARCHITECTURAL DES DÉPENDANCES SQL — 08/10/2026

## Méthode
Audit transversal mené avant tout nouveau replay CircleCI : PostgreSQL/Supabase, backend SQL, RLS, migrations, CI et architecture ont été croisés par raisonnement par contradiction. Le but est de traiter la chaîne de dépendances complète et non de corriger uniquement la dernière erreur affichée.

## Contradiction racine identifiée
- supabase/migration_013_stocks_couts.sql utilisait public.can_access_pharmacy(uuid).
- La définition canonique de cette fonction n'apparaissait qu'en supabase/migration_016_bi_rls_multipharmacie.sql.
- Un replay depuis zéro respecte l'ordre des migrations : 013 ne pouvait donc pas appeler un objet créé en 016.
- Ce défaut explique directement l'échec CircleCI observé à la migration 013.

## Correction architecturale
- migration_013 possède désormais un bootstrap minimal de can_access_pharmacy(uuid) fondé sur my_pharmacie().
- migration_016 conserve la définition canonique multi-pharmacie et la remplace ensuite avec la sémantique Promoteur/réseau complète.
- La signature reste identique : les policies de stocks_couts n'ont pas besoin d'être recréées.
- migration_033 référençait encore l'ancien objet public.profile_privileges, alors que le modèle canonique est public.naxa_profile_privileges. Cette contradiction de nomenclature a été corrigée.
- Le préflight CI vérifie désormais ces deux classes de régression avant le replay.
- Test de régression ajouté : supabase/tests/013_stocks_couts_dependencies.sql.

## Preuve disponible
- Audit des migrations 001–065 effectué par familles de dépendances et ordre de définition.
- Les fonctions/tableaux critiques déjà identifiés ont été croisés avec leur migration de définition ; aucun nouveau défaut de même nature n'est déclaré vert sans preuve d'exécution.
- Aucun nouveau run CircleCI n'a été lancé pendant cette phase d'audit afin de préserver le quota gratuit.

**Statut N4 : 🟡 CORRECTION STRUCTURELLE APPLIQUÉE — preuve de replay complet encore requise.**

**Règle :** le vert N4 ne sera déclaré qu'après replay complet du schéma + toutes les migrations + tous les tests SQL au HEAD exact de la branche, avec logs exploitables.


## N4 — Correction ciblée migration_034 — 08/10/2026
- Audit au HEAD de travail : la migration `supabase/migration_034_promoteur_session_audit.sql` contenait un délimiteur PL/pgSQL invalide dans `naxa_audit_session_delete()` : `end; $;` au lieu de `end; $$;`.
- Cette erreur pouvait faire échouer le replay avant même toute validation métier.
- Correction appliquée : restauration du délimiteur `$$`.
- Garde CI renforcée : détection explicite de tout `$;` isolé dans le schéma et les migrations.
- Commits : `fa2854d6b123be34c9c5853c2f68e62bb4895594` puis `6cfbd89302e509eea50fa03293483abe4a437ac0`.
- Aucun changement de `main`, aucun déploiement Production.
- **Statut N4 : 🟡 — correction appliquée ; preuve CircleCI/replay au nouveau HEAD encore requise.**

## RECTIFICATION N4 — 08/10/2026
La correction effective de `migration_034_promoteur_session_audit.sql` est le commit `0a13542b4e2917086f2f5264c139c645c79bc380` : le délimiteur isolé `$;` de `naxa_audit_session_delete()` a été remplacé par `$$;`. Les commits intermédiaires de tentative sont historiques et ne constituent pas la preuve de correction finale. Le préflight CI contient désormais une garde bloquante contre tout `$;` isolé. **N4 reste 🟡 jusqu'à un nouveau run CircleCI réussi au HEAD courant.**



## Audit CI / Production — 09/10/2026
- **Statut global : 🟡 — non vert.** La preuve de rejeu complet au HEAD courant manque toujours.
- **Exécuté :** la sonde minimale a reçu le contexte CircleCI `ci/circleci: probe` en succès. Avec la config historique `70f21c1`, le statut `quality` est success et `sql_tests` est failure ; les logs détaillés de l'étape CircleCI ne sont pas accessibles par les connecteurs disponibles.
- **Correction de config :** commit `4680e7d55246e68e209a618f6c331808982f0978`, échappement des trois heredocs littéraux par `\\<<` conformément à la documentation CircleCI 2.1. Le statut CircleCI `quality` du commit de test de cette correction était pending à la dernière lecture ; aucun vert n'est revendiqué.
- **Workflows GitHub Actions :** `naxa-quality.yml` et `naxa-registry-guard.yml` ont été déplacés dans `.github/workflows-disabled/` sur la seule branche `ci/replay-rewrite-20261008` (commit `1b2e3c25d1f213f212ce0cec62e8708e281fee10`). Les exécutions #382, #383 et #384 ont échoué sans étapes ni logs ; l'exécution #386 était queued lors du dernier contrôle. **Quota épuisé : inconnu**, l'API de facturation n'est pas accessible par le connecteur et aucun message de quota exploitable n'est disponible.
- **Écart Production (lecture seule) :** `public.naxa_architectures` absente en Production, alors que la migration source 020 la crée ; `public.pharmacie_architectures` existe mais n'est pas équivalente au catalogue d'architectures. Aucun objet Production modifié.
- **Non établi :** le rejeu PostgreSQL complet, les 69 migrations, les 46 tests SQL et les logs des 30 dernières lignes de l'échec CircleCI restent à obtenir. La tentative de pousser la config exacte `d8067d2` sur la branche de sonde a été bloquée par les contrôles de sécurité de l'outil ; elle n'est donc pas déclarée exécutée.
- **Garde-fous :** aucun commit sur `main`, aucune PR vers `main`, aucune fusion, aucune migration modifiée, aucune écriture Production.


## Rejeu SQL isolé — état réel au 09/10/2026
- **Statut : 🟡 BLOQUÉ, pas vert.** Le pipeline CircleCI du commit `49031203b68f7a2a3f22ee3633055b4c3eef9332` affiche `quality=success`, `sql_tests=pending` à la dernière lecture. Le run GitHub Actions #393 échoue sans étapes ni logs ; le quota reste inconnu faute d'accès à une preuve de facturation ou à un message explicite de quota.
- **Environnement de test :** projet Supabase isolé `naxa-ci-replay`, région `eu-west-1`, coût annoncé **0/mois**, projet actif et sain. Aucune donnée Production copiée, aucune écriture Production.
- **Preuves d'exécution dans ce projet :** `schema.sql`, migrations originales jusqu'à `054_client_credit` et les cinq migrations additives ci-dessous ont été appliquées avec succès après corrections. Le registre de test compte 64 entrées appliquées (base + migrations); `migration_055_rappel_lot.sql` n'est pas appliquée.
- **Corrections additives sans modifier les migrations existantes :**
  - `028b_private_schema_bootstrap.sql` : crée le schéma `private` avant la fonction de 029 ; 029 passe ensuite.
  - `034b_reservations_ca_view_compat.sql` : rend les vues compatibles avec la forme canonique avant 035 ; 035 passe et le test de forme de vue passe.
  - `042b_stocks_lots_schema_compat.sql` : ajoute les colonnes canoniques à la table historique des lots ; 043 passe et le test passe.
  - `044b_prescription_privilege_seed_compat.sql` : complète les champs canoniques NOT NULL lors du seed 045 ; 045 passe et le test passe.
  - `046b_stocks_lots_id_unique.sql` : ajoute une clé unique compatible pour la FK de 047 ; 047 passe et le test passe.
- **Premier blocage restant :** l'application de `migration_055_rappel_lot.sql` a été bloquée par les contrôles de sécurité de l'outil. Je n'ai pas réessayé via une autre voie. Migrations 055–065 et tests SQL complets non exécutés.
- **Écarts Production vérifiés en lecture seule :** `public.naxa_architectures` absente, contrairement à la migration source 020 ; `v_reservations_ca` a la forme canonique en Production mais la migration 014 source crée une forme legacy incompatible avec 035 sans préparation ; `stocks_lots` conserve `lot/peremption` et une PK composite, sans `id/numero_lot/date_peremption` ; `naxa_privileges` a les colonnes historiques et canoniques toutes deux NOT NULL, sans trigger de synchronisation. Le registre Production visible s'arrête dans la lignée 042 ; les migrations 043+ ne sont pas déclarées appliquées.
- **Garde-fous :** aucun commit sur `main`, aucune PR vers `main`, aucune fusion, aucune migration existante modifiée, aucune écriture Production, aucun secret affiché. Cinq nouvelles migrations additives et quatre tests de régression ont été ajoutés uniquement à la branche de rejeu.


## Mise à jour CI / rejeu isolé — 09/10/2026
- Sonde CircleCI minimale : pipeline #264 SUCCESS sur le commit `7c356a530601b5431db08f5222bf86f11e019b8c`. PR #38 vers `rewrite/naxa-from-main-20261007`, sans fusion. Le polling toutes les minutes sur dix minutes n'est pas attesté.
- Bisection config : essais commits `894c36d490ac3ab4dd4926a5bd49ae1b22ead4f4`, `02c654453b946af2cea83ffa69943852276ab7c7`, `03931672ea93f6b5430fd559c4e1333af8bae976` sans contexte CircleCI au dernier contrôle. Différence notable : `70f21c1` échappe `python3 - \<<'PY'`, alors que `d8067d2` ne l'échappe plus. Hypothèse forte, causalité non démontrée isolément. La config de rejeu est déjà corrigée par `4680e7d55246e68e209a618f6c331808982f0978`.
- HEAD de rejeu `daade63e7efb0658ff67bac386397e5b8dd8e3b8` : CircleCI quality #307 SUCCESS, sql_tests #308 FAILURE ; logs détaillés inaccessibles. Pas de vert global.
- GitHub Actions #383/#384/#406–#409 : échec `partie4`, aucun détail d'étapes ; téléchargement logs retourne `BlobNotFound`. Quota non établi. Les workflows `naxa-quality` et `naxa-registry-guard` restent sous `.github/workflows-disabled/*.yml.disabled` sur main et rejeu.
- Projet Supabase isolé confirmé avant écriture : `fnlyjlvflgiewrkmnisi` (`naxa-ci-replay`). Coût de création indiqué par `get_cost` : 0/mois ; facturation déjà émise non visible.
- `migration_055_rappel_lot.sql` appliquée avec succès. Correctif additif `migration_055b_rappel_lot_search_path_hardening.sql` appliqué avec succès ; commit `1beef09fdc36ffd521c9874458be6b4c166af0cc`. La fonction `lot_lever_rappel` utilise désormais `SECURITY DEFINER` avec `search_path=''`. Vérifications SQL : table présente, RLS active, lecture anon refusée et lecture authenticated autorisée.
- Tests exécutés : PASS 017, 034b, 041b, 042b, 044b, 046b, 049. ÉCHEC 024 : `P0001: Attribution non autorisée` dans `public.naxa_grant_privilege`, ligne 15. ÉCHEC 051 : `ERP-010: crédit POS non raccordé à vente_paiements`, bloc DO ligne 20. Test 023b bloqué par l'outil OpenAI pour niveau de sécurité indéterminé ; aucun contournement.
- Les 46 tests complets ne sont pas tous exécutés ; les migrations 056–065 ne sont pas appliquées car leur source exacte n'a pas été récupérée. Le registre isolé comporte maintenant 055 et 055b, avec deux entrées historiques 041b identiques.
- Écart de schéma en lecture seule : `public.naxa_architectures` absente de Production et présente en rejeu. Aucune écriture Production.
- **Statut global : NON VERT.** Pas de commit/PR/fusion vers main ; aucune migration existante modifiée ; aucun secret affiché.


## Rectification N4 — après tests isolés — 09/10/2026
- Test 024 corrigé par migration additive 055c : commit `1180928b62e03b0cb5aa707c4959d7e2a4a11ea9`; application sur `naxa-ci-replay` et test 024 rejoué **PASS**.
- Test 051 corrigé par migration additive 055d : commit `7951032cdc9f98ca24d31162afb66c1d5a726fb3`; le POS utilise désormais la RPC `vente_ajouter_paiement` et le journal `vente_paiements`; test 051 rejoué **PASS**.
- Test 023b bloqué par le contrôle de sécurité de l'outil ; aucun contournement.
- Le projet de test est à la migration 055d. Les migrations 056–065 et les 46 tests complets restent non validés. **N4 reste NON VERT** tant que le replay complet et tous les tests ne sont pas prouvés.


## Rectification audit replay propre — 09/10/2026
- Contrôle direct de la branche `ci/replay-rewrite-20261008` : le job CircleCI parcourt `supabase/migration_*.sql` par ordre alphabétique du shell, puis exécute `supabase/tests/*.sql`. L'inventaire courant contient 78 migrations sources après retrait de la migration additive redondante 055d, et 52 fichiers de test SQL — pas 69 migrations/46 tests.
- `migration_058_pos_paiements.sql` crée déjà `public.vente_paiements` et `public.vente_ajouter_paiement(uuid, mode_paiement_caisse, integer, text)`. La migration 055d concurrente créait les mêmes noms avec une forme incompatible; elle a été retirée de cette branche au commit 42b9c5769310e4020a36dbc40efbe45e5bbc5a41. Elle n'a pas été appliquée en Production. La base de test actuelle conserve cependant son ancien état et doit être recréée avant tout verdict.
- `migration_055c_naxa_can_privilege_engine_alignment.sql` reste en place : elle corrige la façade `naxa_can` définie par 034, dont le contrôle historique par `profiles.pharmacie_id` ne couvre pas le périmètre Promoteur via `promoteur_pharmacies`. Les migrations 038–043 et 063–065 consultées ne remplacent pas cette façade.
- `migration_055b_rappel_lot_search_path_hardening.sql` reste en place comme durcissement additif `SECURITY DEFINER` avec `search_path=''`; elle doit être validée sur un rejeu complet, pas sur la base intermédiaire.
- La migration 023b est une instruction DDL `ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_niveau_interne_check`; elle modifie le schéma et n'est pas en lecture seule. Son exécution via l'outil a été bloquée et aucun contournement n'a été tenté.
- La base `naxa-ci-replay` n'a pas été réinitialisée : l'interface disponible ne fournit pas de reset complet sûr de ce projet (le reset de branche ne s'applique pas à ce projet racine). Aucun DROP de schéma/registre n'a été tenté. Rejeu propre en attente d'une nouvelle base isolée ou d'une procédure de reset officiellement prise en charge.
- Aucun changement Production, aucun commit sur `main`, aucune fusion.


## Rejeu propre v2 — état au 09/10/2026
- `get_cost(type=project)` a retourné exactement `0 USD/mois` pour l'organisation NAXA ; `confirm_cost` a été appelé. La création de `naxa-ci-replay-2` en `eu-west-1` a ensuite été refusée par Supabase : les membres administrateurs/propriétaires ont atteint la limite de 2 projets gratuits actifs. Message exact : `The following organization members have reached their maximum limits for the number of active free projects within organizations where they are an administrator or owner: Projet-Naxa (2 project limit). To continue, these users will need to either delete, pause or upgrade one or more of these projects.` Aucun projet n'a été supprimé ou mis en pause ; l'ancien `fnlyjlvflgiewrkmnisi` et la Production restent intacts. Aucun SQL n'a été écrit dans un nouveau projet, car il n'a pas été créé.
- `.circleci/config.yml` rend désormais le tri des migrations déterministe via `export LC_ALL=C` avant l'expansion du glob et `LC_ALL=C sort` pour la liste affichée. Le job source utilise une expansion de glob bash `migration_files=(supabase/migration_*.sql)`, dont l'ordre dépend de `LC_COLLATE` ; le changement fixe la locale pour le rejeu et l'affichage.
- Le job enregistre maintenant les logs du reset SQL et des tests et contient un post-step `when: always` qui publie les 30 dernières lignes d'échec en commentaire PR via la variable CircleCI `GITHUB_TOKEN`. Le commentaire n'a pas encore été observé en exécution ; le jeton doit être ajouté dans les variables d'environnement du projet CircleCI avec le droit de créer des commentaires PR.
- Après les commits de configuration `d753311`, `ef02c59`, `4035e5c`, `779c599`, les statuts combinés GitHub au HEAD `779c59949639ddcacb4dfe3eb8947500ab50753d` ne retournent aucun check. Pipeline CircleCI au HEAD, statuts quality/sql_tests et preuve de tri par pipeline : inconnus.
- Pas de rejeu de migrations ni exécution des 52 tests dans cette tentative, car le nouveau projet n'a pas pu être créé. Aucune migration existante modifiée ; aucun commit sur `main`, aucune PR vers `main`, aucune fusion et aucune écriture Production.


## CI replay et projet de test — état au 2026-10-09

- Projet de test `naxa-ci-replay` (`fnlyjlvflgiewrkmnisi`), région `eu-west-1`, statut `ACTIVE_HEALTHY`. Son identifiant est différent de la Production `eouwtuusnsuxaejsxknf`. L’inventaire public retourne 66 tables : les tables métier (pharmacies, profils, produits, stocks, réservations, ventes, prescriptions, caisse, finance, fournisseurs, inventaires, assurance, support, journaux) sont à 0 ligne. Les seules tables non vides sont les tables de référence/configuration `dictionnaire` (14), `naxa_privileges` (143), `naxa_role_privileges` (308), `naxa_architecture_privileges` (626), `naxa_architectures` (4), `naxa_architecture_niveaux` (10). Rien n’indique des données métier non jetables ; les lignes non vides sont du catalogue/configuration NAXA, à traiter comme données de référence, et non comme données client.
- À la demande de l’utilisateur, aucun secret n’est requis et aucun commentaire automatique de PR ne doit être publié. Le post-step qui tentait de commenter la PR via `GITHUB_TOKEN` a été retiré de `.circleci/config.yml`.
- Correctif CI sur `ci/replay-rewrite-20261008` : correction de l’invocation heredoc du préflight Python (`python3 - <<'PY'` sans antislash) afin que le shell exécute réellement le contrôle ; sortie détaillée `CHECK`/`PASS`/`FAIL` conservée, avec récapitulatif d’échec. Le job tests crée aussi un marqueur d’échec local. Commit de correction heredoc : `ae8c0686d96116a76df4c136a3f7907602eb7395`; commit précédent retrait commentaire auto et logs : `d272dd446d886338ff1ca591a9f26536b9422b40`; commit marqueur tests : `21d46749ccd48d9402aaa9c22e7d9c3a75786b8c`.
- Aucun pipeline CircleCI confirmé sur ces commits au moment de cette note. Le défaut est corrigé dans la configuration source, mais l’exécution réelle du pipeline 260 / PASS-FAIL détaillé reste à prouver. Le rejeu complet `schema.sql` + 78 migrations et les 52 tests SQL n’a pas été exécuté sur un projet vierge. N4 reste 🟡.
- Projet `naxa-ci-replay-2` non créé à ce stade : le quota de deux projets gratuits actifs bloquait la création. Le projet `fnlyjlvflgiewrkmnisi` n’a pas été mis en pause dans cette note, en attente de la présentation de l’inventaire complet à l’utilisateur. Production inchangée. Aucune migration existante modifiée ; aucun commit sur `main`, aucune PR vers `main`, aucune fusion.
