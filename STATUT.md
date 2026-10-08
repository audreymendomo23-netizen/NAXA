

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
