

## N4 — Stabilisation du replay SQL par dépendances — 08/10/2026
Le chantier N4 applique une vérification architecturale du graphe des migrations avant de considérer le replay SQL comme fiable. Une migration ne peut plus attribuer/révoquer les droits d'une fonction avant que cette fonction soit définie ; les références historiques inconnues sont traitées comme des défauts bloquants. La correction actuelle cible la contradiction de migration_020_architecture_privileges.sql, qui contenait des GRANT/REVOKE prématurés sur le moteur d'autorisation. Le replay complet CircleCI reste la preuve finale requise.
# NAXA : base de l'application

Votre médicament, à 2 minutes. Next.js 14 + Supabase + Tailwind, PWA, 100 % offre gratuite.

## Démarrage
1. npm install
2. Créer un projet Supabase (gratuit). Dans Database > Extensions, activer pg_cron.
3. Dans l'éditeur SQL, exécuter dans cet ordre : supabase/schema.sql, supabase/migration_002_catalogue_panier.sql, supabase/migration_003_security_hardening.sql, supabase/migration_004_corrections.sql, supabase/migration_006_auth_profile_age_gate.sql, supabase/migration_007_pharmacie_promoteur_caisses.sql, supabase/migration_008_pharmacie_promoteur_caisses.sql, puis (démo seulement) supabase/seed.sql.
4. Planifier l'expiration des réservations avec le job naxa-expire toutes les 5 minutes.
5. Copier .env.example vers .env.local et renseigner les clés. La clé service_role ne doit jamais être exposée.
6. npm run dev, puis ouvrir /admin après avoir configuré un compte administrateur.

## Fonctionnalités
Recherche et scan d'ordonnance (OCR avec choix import téléphone/caméra), accès protégé par connexion pour les actions opérationnelles, traduction des noms de médicaments du bandeau « Les plus recherchés », classement prix/distance/temps, circulation, réservation 3 h, WhatsApp, paiement guidé par code marchand, reçu imprimable, panneau pharmacie, espace admin, fiches produits, panier et PWA.

Aucune photo de médicament n'est fournie : à ajouter par l'équipe NAXA (droits d'usage à vérifier).

## État

### Phase 0 — terminée et validée
- Cahier des charges et prompt maître lus et pris comme sources de vérité.
- Code existant conservé ; aucune réécriture de l'application.

### Phase 1 — fondations — consolidée
- Projet Supabase NAXA connecté et sain.
- Schéma initial + migrations catalogue/panier, sécurité et âge appliqués.
- RLS activé sur les tables publiques concernées.
- Données de démonstration chargées.
- pg_cron activé et expiration des réservations planifiée toutes les 5 minutes.
- Parcours compte : connexion username/mot de passe, récupération username → OTP e-mail → changement de mot de passe, création en 3 étapes, unicité username, téléphone avec indicatif/pays et date de naissance.
- Google OAuth : connexion directe sans OTP, callback finalisant correctement la session Supabase et conservation de la destination retour.
- Validation d'âge : 3 politiques obligatoires côté interface et serveur.
- Contrôles serveur du panier renforcés ; écriture des fiches produits limitée à l'administration.
- Import de stock conservé.
- Accueil : CTA pharmacie isolé, disclaimer repositionné, numéros 1510 / 119 / 1511.
- Documents juridiques : Conditions, Confidentialité et Sécurité enrichis selon le comportement réel.
- Authentification : tous les écrans principaux utilisent désormais le conteneur sans défilement auth-ecran, y compris /nouveau-mot-de-passe.
- Création de compte : bandeau « Les plus recherchés » masqué, interface mobile recentrée/compactée et téléphone séparé en pays, indicatif et numéro avec longueur contrôlée.
- Création de compte : sélecteur pays compact affichant uniquement drapeau + indicatif au repos ; le nom du pays apparaît uniquement à l’ouverture du sélecteur.
- Création de compte : coche jaune de validation ajoutée aux informations correctement renseignées.
- Mot de passe oublié : le serveur vérifie désormais l’existence réelle du compte avant tout envoi d’OTP ; un compte inexistant reçoit une erreur et n’accède pas à l’étape OTP.
- PR #17 : ces deux corrections sont fusionnées dans main, sans migration DB ni réécriture destructive.
- Build Production PR #17 : compilation Next.js réussie, contrôle TypeScript sans erreur bloquante, déploiement Production READY.

### Consolidation finale — 4 octobre 2026
- PR #11 : consolidation authentification, âge, accueil et politiques, fusionnée.
- PR #12 : documentation de consolidation, fusionnée.
- PR #13 : suppression du dernier scroll parasite de /nouveau-mot-de-passe, fusionnée dans main.
- PR #15 : correction finale UX de /creation-compte, fusionnée dans main.
- PR #15 : aucun changement métier, aucune migration DB et aucune réécriture destructive.
- Build Production : compilation Next.js réussie et vérification TypeScript sans erreur bloquante.
- Déploiement Production final issu de main : READY sur le projet Vercel existant naxa.
- Correction PR #13 strictement ciblée : min-h-screen remplacé par le conteneur d'authentification existant auth-ecran (100dvh + overflow:hidden), sans changement fonctionnel.
- Contrôle statique des cinq écrans principaux : /connexion, /creation-compte, /mot-de-passe-oublie, /verification-age, /nouveau-mot-de-passe : aucun conteneur de page ne conserve de scroll volontaire.

### Phase 3 — pharmacies pilotes — infrastructure consolidée
- PR #19 : panneau pharmacie renforcé, fusionnée dans main.
- Stock : quantité réellement modifiable depuis `/pharmacie` ; persistance dans `stocks` conservée avec le mécanisme `updated_at` existant.
- Garde : bouton « De garde » branché sur la RPC sécurisée `set_garde` existante.
- Hors connexion : file locale IndexedDB pour les modifications manuelles de quantité, badge « Hors connexion », synchronisation au retour réseau.
- Conflits : comparaison de `updated_at` avant écriture distante ; l'équipe pharmacie peut garder la valeur serveur ou réappliquer sa modification locale.
- Import existant conservé : Excel/CSV, reconnaissance des colonnes nom/désignation/produit, prix, quantité, dosage/conditionnement et péremption.
- Vérification Supabase du 5 octobre 2026 : 3 pharmacies de démonstration actives existent déjà à Yaoundé, avec 3 lignes de stock chacune. Elles ne sont pas considérées comme des pharmacies pilotes réelles tant que les données/équipes réelles n'ont pas été fournies.
- Aucune nouvelle table, migration ou dépendance ajoutée pour ce chantier.

### Architecture des comptes pharmacie — consolidée en Production
- Une pharmacie reste une seule entité côté client : un seul stock, une seule identité et les mêmes réservations pour toute l'équipe.
- Le compte principal de la pharmacie est le **Promoteur**. L'équipe NAXA crée la pharmacie et son compte Promoteur ; la pharmacie devient ensuite autonome.
- Le Promoteur est le compte parent : il crée, bloque et réactive les comptes **Caisses** enfants.
- Les Caisses sont des utilisateurs opérationnels de la même pharmacie, pas des sous-pharmacies. Elles partagent le stock, les réservations et le statut de garde de leur pharmacie.
- Un compte Caisse bloqué perd son accès opérationnel sans désactiver la pharmacie ni les autres caisses.
- La formation terrain doit utiliser les comptes Caisse pour apprendre l'import et la gestion quotidienne du stock, afin que l'équipe pharmacie prenne elle-même la main.

### Règles de gouvernance
- PR #21 : architecture Promoteur parent / Caisses enfants, fusionnée dans `main` par squash après évaluation complète.
- Déploiement Production issu de la consolidation PR #21 : READY sur le projet Vercel existant `naxa`.
- Contrôle post-déploiement : commit `5ad95ce30dd43b3c140e0048606c81dd5143e490`, Vercel READY, aucun log runtime `error/fatal` sur les 30 premières minutes contrôlées.
- Aucun déploiement Preview volontaire.
- Production uniquement après évaluation complète et autorisation explicite.
- Aucune suppression ou réécriture destructive.
- Le prompt maître et le cahier des charges restent prioritaires.

## Production
- Projet Vercel existant : `naxa`.
- Déploiement Production courant : `dpl_CcFGneLjZjBSLQ32Mccww6vjwAD6`, commit `5ad95ce30dd43b3c140e0048606c81dd5143e490`, état **READY**.
- Alias Production : `naxa-opal.vercel.app` et `naxa-naxa3.vercel.app`.
- Le déploiement provient de `main` après fusion de PR #21.
- Contrôle post-déploiement : état Vercel READY ; statut GitHub Vercel SUCCESS ; aucun log runtime error/fatal trouvé sur la fenêtre de contrôle de 30 minutes.
- Aucun nouveau projet Vercel et aucun Preview volontaire.

## Prochain point du cahier des charges
La consolidation technique est terminée et la fonctionnalité Promoteur/Caisses est en Production. Il reste la **mise en service terrain réelle** :
1. identifier 3 à 5 pharmacies pilotes réelles ;
2. créer leurs comptes Promoteur via l'accès NAXA `/admin` ;
3. faire créer/activer par chaque Promoteur les comptes Caisses de son équipe ;
4. importer leurs stocks réels via le mécanisme existant ;
5. vérifier fraîcheur, prix, quantités, péremptions et formats ;
6. former les équipes à `/pharmacie` (réservations, stock, statut de garde, hors connexion) ;
7. valider le parcours complet sur données réelles avant de passer au chantier Qualité.
Le chantier suivant devra préserver les règles : aucune auto-inscription pharmacie, aucun numéro WhatsApp côté client, aucune livraison, réservation/paiement facultatifs.


## Mise à jour de continuité — 08/10/2026 — Niveau 1 Documentation
La section historique ci-dessus reste conservée. Pour l'état courant, la référence est :
- branche de travail : `rewrite/naxa-from-main-20261007` ;
- HEAD de travail au contrôle : `b2fc8b793cbac1d11a089c88d736386faf0af658` avant les corrections documentaires de niveau 1 ;
- `main` au contrôle : `2e96930c5d8fb0de4ad22cf4f3dd8dd95b4fd471` ;
- PR #30 : fermée, non fusionnée (validation CI remplacée par le gate CircleCI) ;
- Qualité/CI : non verte ; aucune preuve d'exécution ne doit être inventée ;
- Production : aucun changement effectué dans ce chantier.

**Priorité actuelle :** corriger et prouver la qualité avant tout passage ERP supplémentaire. Les paragraphes historiques annonçant une consolidation « terminée » ne valent pas fermeture du chantier Qualité courant.

**Niveau 1 — Documentation / traçabilité : 🟢 corrigé.** Références complémentaires : `docs/CONTINUITE_NAXA.md`, `docs/FUSION.md`, `CONTRADICTIONS.md`, `docs/CAHIER_DES_CHARGES.md`.


## Niveau 2 — Gouvernance Git — 08/10/2026
Le chantier courant est `rewrite/naxa-from-main-20261007`. `main` reste la source de vérité et n'a pas été modifié. Les branches historiques sont conservées comme archives et ne constituent pas des sources concurrentes. Voir `docs/GIT_GOUVERNANCE.md`.

**Niveau 2 : 🟢 corrigé.**


## État du chantier — Niveau 3
Le niveau 3 a fait l'objet d'une correction statique : ESLint/Next configuré, script lint rendu exploitable et versions npm figées. La preuve d'exécution TypeScript/lint/build reste à obtenir via un runner réel. Le dépôt ne contient toujours pas de `package-lock.json`, et la génération locale a été bloquée par l'absence d'accès au registre npm. **Le niveau 3 n'est donc pas déclaré vert.**


## Mise à jour de continuité — Niveau 3 — 08/10/2026
- Gate CircleCI réel : **SUCCESS** sur le commit `f1fcd801f37989bdd17e667a0e88c17dd3e5f4e6`, pipeline #167.
- Contrôles exécutés : installation npm, TypeScript, ESLint et build Next.js.
- Niveau 3 : **🟢 VERT** pour la qualité technique exécutée.
- `package-lock.json` reste absent ; la reproductibilité npm transitive est enregistrée comme amélioration séparée et n'est pas présentée comme validée.
- `main` reste inchangé et aucune Production n'a été modifiée.


## Méthode de validation bulk — 08/10/2026

Les niveaux N4 à N15 sont audités simultanément par cause commune. L'objectif est de réduire tous les écarts de validation à un seul blocage transversal : **obtenir une exécution reproductible, alignée sur le HEAD de la branche, du schéma + migrations + tests**. L'accès Supabase distant est désormais fonctionnel ; sa divergence avec la branche de travail interdit seulement de l'utiliser comme preuve des nouveaux changements sans modifier Production. Aucun merge vers `main` et aucun déploiement Production n'est effectué par ce chantier.


## Référence de continuité courante — 08/10/2026

> Cette section supersède les anciennes références de HEAD conservées dans l'historique du README.

- Branche de travail : `rewrite/naxa-from-main-20261007`
- HEAD courant vérifié : `5b24b96098ed240ddb9ade154e22f66969faa2df`
- `main` courant vérifié : `2e96930c5d8fb0de4ad22cf4f3dd8dd95b4fd471`
- Relation : **behind = 0**, branche ahead de `main`, merge-base = `main` HEAD.
- PR #30 : ouverte, draft, non fusionnée.
- Aucun merge vers `main`, aucun déploiement Production dans ce chantier.
- Les anciens SHA de reprise restent historiques.
- N4–N15 doivent être validés uniquement par une preuve d'exécution reproductible au HEAD courant.

**Statut de continuité : 🟢 aligné sur le HEAD courant.**


## N4 — Audit architectural des dépendances SQL — 08/10/2026
Le blocage N4 n'est plus traité erreur par erreur. L'audit transversal a identifié une contradiction d'ordre de construction : migration_013 utilisait `can_access_pharmacy(uuid)` alors que sa définition canonique n'arrivait qu'en migration_016. Un bootstrap compatible a été placé en 013, puis 016 conserve le remplacement canonique multi-pharmacie. Une seconde contradiction de nomenclature, `profile_privileges` versus `naxa_profile_privileges`, a été corrigée en migration_033. Le préflight CircleCI et un test de régression dédiés verrouillent désormais ces deux familles d'erreurs.

**N4 reste 🟡 jusqu'à la preuve réelle du replay complet + de tous les tests SQL au HEAD courant. Aucun nouveau run CircleCI n'a été consommé pendant l'audit.**


## Mise à jour N4 — 08/10/2026
Le replay SQL a révélé un défaut syntaxique ciblé dans `migration_034_promoteur_session_audit.sql` : le corps de `naxa_audit_session_delete()` se terminait par un délimiteur dollar invalide `$;`. La correction a restauré `$$;` et le préflight CircleCI détecte désormais explicitement ce type de délimiteur malformé. Cette correction est additive et ne modifie ni `main` ni Production. Le vert reste interdit tant qu'un nouveau replay complet et tous les tests SQL n'ont pas fourni une preuve au HEAD courant.

## Rectification N4 — 08/10/2026
Correction effective : `migration_034_promoteur_session_audit.sql` ne contient plus le délimiteur PL/pgSQL isolé `$;` dans `naxa_audit_session_delete()` ; il est restauré en `$$;`. Commit effectif : `0a13542b4e2917086f2f5264c139c645c79bc380`. Le préflight CI bloque désormais ce défaut. Aucun vert N4 n'est déclaré avant une nouvelle exécution complète au HEAD courant.



## Audit CI de rejeu — 09/10/2026
- CircleCI 2.1 interprète `<<` comme un délimiteur de templating ; les heredocs shell littéraux doivent employer `\\<<`. Référence : https://circleci.com/docs/guides/orchestrate/config-templating/.
- Correction additive de `.circleci/config.yml` au commit `4680e7d55246e68e209a618f6c331808982f0978` : échappement des heredocs Python, TOML et SQL.
- Sur la branche de rejeu uniquement, les workflows Actions `naxa-quality` et `naxa-registry-guard` sont rangés dans `.github/workflows-disabled/` au commit `1b2e3c25d1f213f212ce0cec62e8708e281fee10`. Aucun changement sur `main` ni sur Production.
- Sonde minimale : commit `7c356a530601b5431db08f5222bf86f11e019b8c`, contexte `ci/circleci: probe` = success. Essai de la config `70f21c1` : `quality` = success, `sql_tests` = failure au commit de test `e29550ee7a3b1e6ddef7cb799f20f2f20b8ca94b`; logs CircleCI détaillés non accessibles via les connecteurs disponibles.
- Au HEAD `1b2e3c25d1f213f212ce0cec62e8708e281fee10`, `ci/circleci: quality` est encore pending à la dernière vérification. Aucun vert n'est déclaré.
- Écart Production confirmé en lecture seule : `public.naxa_architectures` est absente alors que la migration source 020 la crée ; `public.pharmacie_architectures` existe mais représente une affectation par pharmacie, pas le catalogue `naxa_architectures`. Aucune écriture Production.


## Rejeu SQL isolé — progression et blocages — 09/10/2026
- Un projet Supabase de test isolé `naxa-ci-replay` a été créé en région `eu-west-1`, coût annoncé : **0 / mois**. Il ne contient aucune donnée métier copiée et aucune écriture Production n'a été effectuée.
- Le schéma de base et les migrations sources jusqu'à `054_client_credit` ont été appliqués dans ce projet. Cinq migrations additives ont été ajoutées à la branche de rejeu, sans modifier les migrations existantes : `028b_private_schema_bootstrap`, `034b_reservations_ca_view_compat`, `042b_stocks_lots_schema_compat`, `044b_prescription_privilege_seed_compat`, `046b_stocks_lots_id_unique`.
- Échecs réels corrigés et rejoués avec succès sur la base isolée : migration 029 (schéma `private` absent), migration 035 (changement de forme incompatible de `v_reservations_ca`), migration 043 (socle `stocks_lots` historique sans `date_peremption`), migration 045 (colonnes canoniques NOT NULL absentes du seed de privilèges), migration 047 (absence de clé unique sur `stocks_lots.id`). Les tests de régression ajoutés pour les vues, les lots et le seed prescription se sont exécutés sans exception.
- **Blocage courant :** l'application de `migration_055_rappel_lot.sql` a été refusée par les contrôles de sécurité de l'outil. Aucun contournement ni autre canal d'application n'a été utilisé. Les migrations 055–065 et la suite SQL complète ne sont donc pas déclarées PASS.
- CircleCI au commit `49031203b68f7a2a3f22ee3633055b4c3eef9332` : `quality` = success ; `sql_tests` = pending lors de la dernière lecture. Aucun vert global.
- Production reste en lecture seule. Son registre de migrations s'arrête à la lignée `042`; les objets des migrations 043+ ne sont donc pas considérés déployés. Écarts confirmés : `naxa_architectures` absente malgré sa création dans la source 020 ; `v_reservations_ca` est canonique en Production alors que la source 014 crée une ancienne forme ; `stocks_lots` reste sur les colonnes historiques `lot/peremption` avec clé primaire composite ; le catalogue `naxa_privileges` conserve les deux familles de colonnes sans trigger de synchronisation.


## Rapport d'exécution CI / rejeu isolé — 09/10/2026 (mise à jour)
- Sonde CircleCI minimale : commit `7c356a530601b5431db08f5222bf86f11e019b8c`, contexte `ci/circleci: probe` SUCCESS, pipeline #264. PR de diagnostic #38 vers `rewrite/naxa-from-main-20261007`, sans fusion. Le suivi minute par minute pendant dix minutes n'a pas été réalisé.
- Bisection sur la branche de sonde : commits `894c36d490ac3ab4dd4926a5bd49ae1b22ead4f4` (config de d8067d2), `02c654453b946af2cea83ffa69943852276ab7c7` (24dfe2a) et `03931672ea93f6b5430fd559c4e1333af8bae976` (c7c055e). Aucun statut CircleCI n'était attaché à ces trois commits au dernier contrôle. La première différence visible entre 70f21c1 et d8067d2 est le retrait de l'échappement sur `python3 - <<'PY'`; c'est cohérent avec l'absence de compilation, mais la causalité n'est pas considérée prouvée par les seuls statuts historiques. La configuration de rejeu a déjà les heredocs Python, TOML et SQL échappés au commit `4680e7d55246e68e209a618f6c331808982f0978`.
- CircleCI au HEAD de rejeu vérifié `daade63e7efb0658ff67bac386397e5b8dd8e3b8` : `quality` SUCCESS (#307), `sql_tests` FAILURE (#308). Les logs détaillés CircleCI ne sont pas accessibles par les connecteurs disponibles ; aucun vert global.
- GitHub Actions #383, #384 et #406–#409 : job `partie4` FAILURE, `steps=null`, `logs_url=null`; le téléchargement des logs retourne `BlobNotFound`. Le quota Actions n'est pas vérifiable avec les accès disponibles. Les workflows `naxa-quality` et `naxa-registry-guard` sont bien sous `.github/workflows-disabled/*.yml.disabled` sur `main` et la branche de rejeu ; ils n'ont pas été déplacés davantage.
- Supabase isolé : projet cible vérifié avant chaque écriture : `fnlyjlvflgiewrkmnisi` (`naxa-ci-replay`). `get_cost` indique 0/mois pour la création d'un projet ; l'état de facturation déjà émise n'est pas exposé. Migration `055_rappel_lot` appliquée avec succès, puis correctif additif `055b_rappel_lot_search_path_hardening` appliqué avec succès. Le correctif force `search_path=''` pour `lot_lever_rappel`, qui utilisait auparavant `search_path=public` en `SECURITY DEFINER`. Commit additif : `1beef09fdc36ffd521c9874458be6b4c166af0cc`.
- Vérifications exécutées après 055b : table `rappels_lots` présente, RLS active, politique SELECT limitée aux comptes authentifiés et au périmètre, SELECT refusé à `anon`, accordé à `authenticated`; `lot_lever_rappel` est bien `SECURITY DEFINER` avec `search_path=''`.
- Tests SQL directement exécutés dans la base isolée : PASS `017_hierarchie_securite.sql`, `034b_reservations_ca_view_compat.sql`, `041b_naxa_has_privilege_network_scope_guard.sql`, `042b_stocks_lots_schema_compat.sql`, `044b_prescription_privilege_seed_compat.sql`, `046b_stocks_lots_id_unique.sql`, `049_assurances.sql`. ÉCHEC `024_promoteur_perimetre.sql` : `P0001: Attribution non autorisée`, depuis `public.naxa_grant_privilege(uuid,text,uuid,text)`, ligne 15. ÉCHEC `051_client_credit.sql` : `ERP-010: crédit POS non raccordé à vente_paiements`, bloc DO ligne 20. `023b_profiles_niveau_interne_constraint.sql` : appel bloqué par le contrôle de sécurité de l'outil (« nous n’avons pas pu déterminer le niveau de sécurité de la demande »), non contourné.
- Les 46 tests complets n'ont pas été exécutés : les connecteurs disponibles n'exposent pas la liste intégrale des fichiers du répertoire de tests et deux tests ci-dessus échouent. Les migrations 056–065 n'ont pas été appliquées faute de pouvoir identifier et lire leur source exacte. Le registre isolé inclut désormais 055 et 055b ; les deux entrées 041b restent dupliquées dans le registre.
- Production `eouwtuusnsuxaejsxknf` : aucune écriture. `public.naxa_architectures` est absent en Production et présent dans la base de rejeu ; `pharmacie_architectures`, `v_reservations_ca` et `stocks_lots` existent dans les deux bases, sans que leur équivalence complète soit établie.
- **Statut final : NON VERT.** Aucun commit sur `main`, aucune PR vers `main`, aucune fusion, aucune migration existante modifiée, aucun secret affiché, aucune écriture Production.


## Rectification — corrections additives après exécution des tests — 09/10/2026
- Le test `024_promoteur_perimetre.sql` échouait parce que `public.naxa_can('ASSIGN_PRIVILEGE', ...)` renvoyait toujours faux pour un Promoteur : l'ancienne façade ne reconnaissait que CREATE_CAISSE/BLOCK_CAISSE/REACTIVATE_CAISSE et vérifiait `profiles.pharmacie_id`, incompatible avec le scope Promoteur par liens. Correction additive `migration_055c_naxa_can_privilege_engine_alignment.sql`, commit `1180928b62e03b0cb5aa707c4959d7e2a4a11ea9`, appliquée sur `naxa-ci-replay`. Rejeu du test 024 : **PASS** (résultat JSON confirme liens Promoteur, RLS, refus anon, accès authenticated, unicité et exclusion gouvernance).
- Le test `051_client_credit.sql` a révélé que le POS ne possédait ni table `vente_paiements` ni RPC `vente_ajouter_paiement`, alors que le crédit client marquait directement la vente comme payée. Correction additive `migration_055d_pos_paiements_credit.sql`, commit `7951032cdc9f98ca24d31162afb66c1d5a726fb3`, ajoutant un journal de paiement POS protégé par RLS et raccordant la vente à cette RPC. Migration appliquée sur la base isolée ; test 051 rejoué : **PASS** (bloc DO retourne sans exception).
- Le test `023b_profiles_niveau_interne_constraint.sql` reste **BLOQUÉ** : l'outil a explicitement refusé son exécution faute de pouvoir déterminer le niveau de sécurité. Ce refus n'a pas été contourné.
- Le registre isolé va maintenant jusqu'à `migration_055d_pos_paiements_credit` (versions `20261009124107` et `20261009124144` pour 055c/055d). Les migrations 056–065 et la suite de 46 tests restent à exécuter ; le vert global est interdit.


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


## Mise à jour après contrôle du 2026-10-09 — état final de cette tentative

- Inventaire préalable du test `fnlyjlvflgiewrkmnisi` : 66 tables publiques ; les 60 tables métier et de journaux listées à zéro, et seules les tables de référence/configuration non vides : `dictionnaire` 14, `naxa_privileges` 143, `naxa_role_privileges` 308, `naxa_architecture_privileges` 626, `naxa_architectures` 4, `naxa_architecture_niveaux` 10. Identifiant différent de Production. Pause autorisée par condition et exécutée ; restauration demandée à la fin. Les deux projets étaient encore en transition (`COMING_UP` pour l’ancien, `PAUSING` pour le nouveau) lors de la dernière vérification ; l’état final stable n’est donc pas confirmé.
- Création de `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`), région `eu-west-1`, à coût 0 $ précédemment confirmé. Le fichier `supabase/schema.sql` (blob `4e5cf6ce703c0ba7e8c21cf43462f25404e83069`) a été appliqué avec succès sur ce projet uniquement. Aucune migration `migration_*.sql` n’a été appliquée et aucun test SQL n’a été lancé : les outils GitHub disponibles dans cette session ne donnent pas la liste des chemins de tous les fichiers du dépôt, nécessaire pour obtenir puis appliquer fidèlement les 78 migrations et les 52 tests dans l’ordre. Je n’invente donc ni la première erreur SQL ni un résultat vert.
- Le projet `naxa-ci-replay-2` a été mis en pause ; restauration de l’ancien `naxa-ci-replay` demandée. Vérification finale en attente de stabilisation des statuts Supabase. Aucun projet supprimé.
- `.circleci/config.yml` : le heredoc du préflight a été corrigé pour invoquer Python via `python3 - <<'PY'` ; les contrôles affichent déjà `CHECK`, `PASS` ou `FAIL` et le récapitulatif des échecs. Le marqueur d’échec des tests est ajouté. Le commentaire automatique PR a été supprimé ; aucun `GITHUB_TOKEN` n’est référencé. Le statut GitHub du commit `ae8c0686d96116a76df4c136a3f7907602eb7395` ne retourne aucun check ; aucun accès CircleCI n’est disponible ici pour relancer ou lire le pipeline 260. La correction de configuration est présente, mais le succès d’exécution du préflight reste non prouvé.
- N4 reste 🟡. Production `eouwtuusnsuxaejsxknf` non touchée ; aucune migration existante modifiée ; aucun commit sur `main`, aucune PR vers `main`, aucune fusion. Coût nouveau projet confirmé à 0 $.
