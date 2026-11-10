# Registre de clôture et de reprise — NAXA (branche de vérification)

> **Document obligatoire à lire avant chaque nouvelle conversation ou session d'agent NAXA.**
> Branche active des vérifications : `qa/e2e-stabilisation-20261106`.
> Dernier commit de code/tests de référence : `d93e1000be26705c1feefd543da904c0bd7c8ec9` — `test(core): assert full FK index coverage`, daté du 09/11/2026 à 23:43:57 UTC. Les commits documentaires de gouvernance suivants n'ont pas changé le code applicatif ; toujours vérifier le HEAD réel au début d'une session.

## 1. Lecture obligatoire avant toute reprise

Avant toute analyse, commande, modification ou proposition technique sur NAXA :

1. Lire intégralement `AGENTS.md`.
2. Lire intégralement le présent registre.
3. Lire `STATUT.md` et les documents de continuité explicitement référencés et présents sur cette branche.
4. Pour une mission Admin 360, lire également `docs/audits/AUDIT_360_ADMINISTRATEUR_NAXA.md` et le NAXA-MANDAT CTO actif.
5. Vérifier le HEAD réel de `qa/e2e-stabilisation-20261106` et le comparer à ce checkpoint.
6. Reprendre uniquement les réserves ouvertes ou les lots réellement touchés par un changement.

**Aucune conversation ne recommence l'audit depuis zéro.** Un lot clos n'est jamais retesté parce qu'une nouvelle conversation commence.

**Condition d'arrêt :** si un document obligatoire est inaccessible, le signaler avant de commencer. Ne pas faire d'audit redondant, modifier le projet à l'aveugle, ni remplacer ces documents par un résumé mémoire.

## 2. Branche de travail et séparation avec main

- **Branche active pour les vérifications :** `qa/e2e-stabilisation-20261106`.
- **Branche par défaut du dépôt :** `main`. Elle n'est pas la branche de travail de cette campagne QA.
- Ne pas écrire sur `main`, ne pas fusionner QA vers main, ne pas créer de branche ou de PR sans ordre explicite ultérieur de l'utilisateur.
- Le relevé de comparaison du 10/11/2026 montre que `qa/e2e-stabilisation-20261106` et `main` ont divergé depuis le commit commun `2374348e416d4745e19546da1151ea1ad8fefa11`. À cet instantané, comparaison GitHub : 482 commits propres à l'historique QA et 11 commits propres à main. Ce résultat décrit une divergence, pas un simple retard linéaire ; ne pas fusionner ou cherry-pick en bloc.
- Un certain nombre de corrections et migrations récentes présentes sur `main` sont absentes de QA. Une preuve exécutée sur Replay à partir de ces fichiers ne prouve pas que la correction est intégrée à la branche QA.

## 3. Règles de preuve et statuts

| Statut | Sens | Règle |
|---|---|---|
| **CLOS — QA** | Critère précis réussi, source présente sur QA, environnement/test identifiés | Ne pas répéter sans déclencheur documenté. |
| **PASS Replay — non intégré QA** | Test exécuté sur Replay depuis une source absente ou différente sur QA | Ne pas annoncer « clos QA ». Intégrer/porter la correction après revue, puis valider la version QA. |
| **VERT CIBLÉ** | Sous-critère démontré, sans certifier le module entier | Toujours conserver la portée exacte. |
| **JAUNE** | Preuve partielle, test non exécuté sur QA, ou runtime absent | Traiter la réserve précise. |
| **ROUGE** | Défaut reproduit ou contradiction confirmée | Corriger la cause racine, retester le scénario affecté. |
| **BLOQUÉ** | Accès, environnement, autorisation ou outil indisponible | Finir les travaux indépendants et noter la cause. |
| **NON ÉVALUÉ** | Données insuffisantes | Ne rien inférer. |

Un lot CLOS peut être rouvert uniquement si : code/migration/schéma/policy/RPC/configuration pertinente modifié(e), régression observée, environnement de preuve réinitialisé ou dérivé, demande explicite de l'utilisateur, ou contradiction probante. Une nouvelle conversation, un changement de modèle ou un compteur Advisor inchangé ne sont pas des déclencheurs.

Chaque réouverture indique le déclencheur, l'ancien SHA de preuve, le nouveau SHA testé et le résultat.

## 4. Checkpoint de branche et contrôles observés

### État Git

- Dernier commit code/tests de référence : `d93e1000be26705c1feefd543da904c0bd7c8ec9` — `test(core): assert full FK index coverage` (09/11/2026 23:43:57 UTC).
- Les commits ultérieurs de cette passe sur QA concernent uniquement les documents de gouvernance ; ils n'ont pas changé les sources applicatives ni les tests.
- Aucun status check GitHub associé à ce SHA n'a été retourné lors du contrôle du 10/11/2026. Cela ne prouve ni réussite ni échec d'une pipeline tierce ; la validation CI reste **non prouvée sur ce SHA**.
- HEAD `main` observé avant les modifications documentaires incorrectement poussées sur main : `3edc5bbd0b11592909e40c99ee8ac606a312941d` (10/11/2026 00:13:44 UTC). Ne pas confondre avec le checkpoint QA.

### Tests SQL Admin présents sur QA

| ID | Source sur QA | Preuve connue | Statut |
|---|---|---|---|
| ADM-EXAM-PUBLIC-02 | `supabase/tests/20261102105033_admin_exam_centers_public_scope.sql` — blob `d493634c4933d73aa9a21b9567f7820954a15002` | Exécution Replay : **PASS — E14 exam public partner scope** | **CLOS — portée SQL E14** |
| ADM-EXAM-READ-01 | `supabase/tests/20261102105542_admin_exam_catalog_active_read.sql` — blob `1c741759e1672fedfe841f99aa7b2472c01686cd` | Exécution Replay : **PASS — E17 Admin exam catalog read matrix** | **CLOS — portée SQL E17** |
| SEC-ADMIN-02 | `supabase/tests/269_admin_exam_services_active_guards.sql` — blob QA `0b4200676752f397aeec661f040569b7b9a8e6a2` | Le PASS à 33 assertions a été obtenu avec une version modifiée du test sur main. Le fichier QA est une version antérieure, et la migration source du correctif `20261110000324` n'est pas présente à cet emplacement sur QA. | **PASS Replay — non intégré/certifié QA** |

### Corrections sécurité constatées sur Replay mais absentes des sources QA

Les opérations suivantes ont été appliquées et vérifiées sur Supabase Replay `pwfftcsjyeibxxqhwysw` dans le travail associé à `main`. Les chemins ci-dessous ont ensuite été recherchés sur la branche QA et **ne sont pas présents sous ces noms** :

| ID | Fichiers présents sur main, absents QA | Preuve Replay | Statut QA |
|---|---|---|---|
| SEC-LOG-01 | `supabase/migrations/20261109235840_restrict_legacy_public_search_logging_20261110.sql` ; `supabase/tests/20261109235840_restrict_legacy_public_search_logging_execution.sql` | ACL relues : anon=false, authenticated=false, service_role=true pour les deux RPC ; finding Advisor anon SECURITY DEFINER correspondant disparu | **PASS Replay — non intégré QA** |
| SEC-ADMIN-02 | `supabase/migrations/20261110000324_admin_is_admin_boolean_false_for_inactive_20261110.sql` ; version corrigée du test 269 | **PASS — 33 assertions structurelles et comportementales** ; refus Admin inactif pour les RPC couvertes | **PASS Replay — non intégré QA** |
| SEC-PROFILE-03 | `supabase/migrations/20261110012000_profiles_rls_active_promoter_scope_20261110.sql` ; `supabase/tests/20261110012000_profiles_rls_active_promoter_scope.sql` | **PASS — active read 1, expired read/update 0, anon read 0** ; fixtures annulées par ROLLBACK ; correction finale de l'instance_id fixture dans commit `3edc5bb` | **PASS Replay — non intégré QA** |

**Conséquence :** ne pas reprendre ces tests comme « clôturés QA ». Réconcilier les différences de source entre les branches et reporter chaque correction vers QA uniquement après analyse de ses dépendances. Ne pas cherry-pick ou fusionner aveuglément les 11 commits main, car les branches sont divergentes.

## 5. Réserves à reprendre sur QA

| ID | Point restant | État | Action ciblée |
|---|---|---|---|
| BRANCH-SOURCE-SYNC | Les trois migrations sécurité du tableau ci-dessus et leurs tests ne sont pas versionnés sur QA sous leurs chemins source | **JAUNE / prioritaire** | Comparer les diffs et dépendances ; porter les corrections pertinentes dans QA puis retester sur Replay |
| SEC-ADMIN-02 | Le test 269 présent sur QA ne correspond pas à la version corrigée exécutée en PASS | **JAUNE QA** | Aligner test et migration sur QA ; rejouer seulement après intégration du changement |
| ADM-STEP13 | `supabase/tests/20261102014000_admin_global_accounts_pilotage.sql` : test d'acceptation non exécuté avec succès (tentative bloquée par les contrôles de sécurité de l'outil) | **JAUNE** | Exécuter sur Replay via un moyen autorisé ou préparer un test transactionnel équivalent prouvable |
| ADM-UI-RUNTIME | Les pages Admin Prestations et réservations sont identifiées dans le code, mais le rendu réel navigateur sur QA n'est pas certifié ici | **JAUNE** | Vérifier le runtime QA sans rejouer E14/E17 |
| ADM-EXAM-LIMITS | Plafonds de lecture Examens et pagination au-delà des limites | **JAUNE** | Vérifier pagination/complétude attendue et preuves navigateur |
| AUTH-BREACH-01 | Protection native Supabase contre les mots de passe compromis désactivée (Advisor Replay : finding 1) ; le contrôle HIBP applicatif ne remplace pas cette fonction native | **JAUNE** | Vérifier environnement et droits, corriger/valider ensuite |
| SEC-DEFINER-REVIEW | Advisor Replay signalait 185 fonctions SECURITY DEFINER exécutables par authenticated ; ce nombre n'est pas 185 vulnérabilités confirmées | **À qualifier** | Revue par signature/ACL/garde interne, prioriser les fonctions mutatrices |
| RLS-NO-POLICY | Advisor Replay signalait 43 tables RLS sans policy ; une absence de policy est deny-by-default pour les rôles concernés, mais grants/exposition à qualifier | **À qualifier** | Revue ciblée des grants, rôles et exposition API |
| RLS-PERMISSIVE | Advisor performance signalait 31 occurrences de policies permissives multiples après nettoyage de profiles sur Replay | **À qualifier** | Examiner les opérations/rôles/expressions en recouvrement ; pas une vulnérabilité par compteur seul |
| DB-MIGRATION-SYNC | Instantané Replay/Main du 10/11 : 30 migrations Replay datées du 09/11, une seule source correspondante trouvée sur main, donc 29 sources non retrouvées sur main à cet instantané. État de la branche QA non rapproché exhaustivement | **ROUGE — traçabilité non certifiée** | Inventaire précis Replay vs QA et main ; retrouver les sources, noms ou migrations hors dépôt ; aucune réapplication aveugle |
| CI-QA-HEAD | Aucun status check GitHub associé à `d93e100` retourné ; aucun résultat de pipeline tierce vérifié ici | **NON ÉVALUÉ** | Vérifier la pipeline associée à ce SHA lorsque les accès le permettent |
| BUILD-QA-HEAD | Build complet, lint et typecheck non prouvés sur `d93e100` | **NON ÉVALUÉ** | Exécuter à la fin du lot ou si exigé par le critère actif |
| E2E-NODE | Recette E2E via Node.js exclue du périmètre déclaré dans le dernier échange correspondant | **HORS CRITÈRE** | Ne pas relancer sans réintégration explicite au périmètre |

### Dernier instantané Advisor Replay connu

- `rls_enabled_no_policy` : 43 (INFO).
- `authenticated_security_definer_function_executable` : 185 (WARN).
- `auth_leaked_password_protection` : 1 (WARN).
- `anon_security_definer_function_executable` : finding ciblé des deux RPC de journalisation disparu après correction sur Replay.
- `multiple_permissive_policies` : 31 (WARN performance).
- `unindexed_foreign_keys` : 146 (INFO).
- `unused_index` : 192 (INFO).

Il s'agit d'un instantané Replay, non d'un état Production ni d'un inventaire de vulnérabilités confirmées. Les compteurs seuls ne réouvrent aucun lot.

## 6. Règle spéciale de réconciliation Git / migrations

1. Vérifier le HEAD QA et main.
2. Comparer chaque migration Replay à tous les fichiers SQL des deux branches.
3. Identifier les changements qui existent uniquement sur main, uniquement sur QA, ou hors dépôt.
4. Lire les dépendances et les objets réels avant de porter une correction.
5. Appliquer les corrections validées dans QA, sans merge global ou cherry-pick aveugle.
6. Exécuter les tests ciblés sur Replay avec rollback lorsque possible.
7. Consigner commit, version de migration réellement appliquée et résultat brut.
8. Ne jamais toucher Production sans autorisation explicite.

## 7. Fiche obligatoire pour tout nouveau lot

| Champ | Valeur |
|---|---|
| ID stable | |
| Lot / critère d'acceptation | |
| Contradiction et cause racine | |
| Branche et HEAD exacts | |
| Environnement exact (Replay/Preview/Production/local) | |
| Migration(s) source + version réellement appliquée | |
| Test / commande / endpoint exact | |
| Résultat brut ou preuve vérifiable | |
| Rollback et résidus vérifiés | |
| Statut | |
| Réserves hors du critère | |
| Déclencheurs de réouverture | |

Toute clôture est datée et rattachée à un commit QA. Un test non exécuté ou un appel d'outil bloqué reste non exécuté.

## 8. Rapport de reprise

Rapport court en français :
- **État :** branche, HEAD et lot repris.
- **Fait :** changement réellement appliqué.
- **Preuve :** environnement, test et résultat exact.
- **Reste :** seules les réserves ouvertes.
- **Suite :** action concrète suivante.

Ne pas réimprimer le registre complet à chaque conversation ; citer les IDs et seulement les deltas depuis le checkpoint.


## 9. Lot STOCK-IMPORT-AI-01 — rapprochement hybride IA + moteur déterministe (10/11/2026)

**Branche :** `qa/e2e-stabilisation-20261106`  
**Commit code/tests :** `cab8b965c3464b4d7acd1285c888a8e4f82440c4` (HEAD de la correction au moment de la recette).

### Fait — implémentation et durcissement

- `src/app/api/pharmacie/gestionnaire-stock/import/match/route.ts` : API serveur authentifiée, vérification du compte actif et de `IMPORT_STOCK` (ou Admin), candidats relus dans le catalogue NAXA et limités par ligne.
- Le mapping IA et le rapprochement acceptent les noms de variables Gemini canoniques et le nom existant `Gemini_API_Key` en Preview ; Groq reste le fournisseur de repli.
- `src/lib/importStock.ts` : vérification déterministe indépendante du code-barres, de la DCI, du dosage, de la forme et du score ; normalisation des unités usuelles dont `µg`/`mcg`. Aucune suggestion IA n'est appliquée sans action humaine.
- `/import/apply` revalide l'utilisateur, son compte actif, son privilège, le catalogue et les identités produits avant toute mutation.
- La mutation ne passe plus directement par la RPC publique depuis le client utilisateur. `supabaseAdmin()` appelle désormais `public.naxa_import_stock_batch_as_actor`, qui exige le rôle `service_role`, fixe l'identité de l'acteur validé dans les claims transactionnels et délègue à la RPC métier existante.
- Migration source : `supabase/migrations/20261110011755_stock_import_rpc_service_role_guard_20261110.sql`. Elle retire EXECUTE sur l'ancienne RPC à `PUBLIC`, `anon`, `authenticated` et `service_role`, puis accorde uniquement la nouvelle entrée serveur à `service_role`.
- `supabase/tests/stock_import_rpc_service_role_guard.sql` vérifie les ACL et exécute une mutation de stock sur Replay dans une transaction annulée.

### Preuves exécutées

- **Node ciblé : 18/18 PASS** — exécution du fichier versionné `node --test scripts/test-stock-import-intelligent.cjs` dans un bac Vercel isolé, après chargement des sources du commit QA et installation de TypeScript 5.6.2. Le test DCI a été corrigé pour vérifier le libellé réel `Principe actif (DCI) absent ou incompatible.`.
- **SQL E2E Replay : PASS** — exécution du fichier versionné `supabase/tests/stock_import_rpc_service_role_guard.sql`. Résultat retourné : `stock_import_rpc_service_role_guard E2E PASS (rollback confirmé)`. La RPC serveur a importé une ligne, la quantité a été contrôlée à +1 dans la transaction, puis le rollback a annulé l'écriture.
- **Syntaxe TypeScript ciblée : PASS** — les trois routes `apply`, `mapping` et `match` ont été transpilées sans diagnostic de syntaxe avec TypeScript 5.6.2. Ce contrôle n'est pas un typecheck sémantique complet.
- **ACL Replay après migration : PASS** — ancienne RPC : `anon=false`, `authenticated=false`, `service_role=false` ; nouvelle RPC : `anon=false`, `authenticated=false`, `service_role=true`.
- **Contrôle après rollback : PASS** — stock de la fixture `NAXA TEST — Pharmacie Bastos` / `Amlodipine NAXA Test` revenu à `26` unités, prix `3 075 FCFA`, égal à la valeur initiale observée. Migration Replay enregistrée sous version `20261110011755`, nom `stock_import_rpc_service_role_guard_20261110`.
- **Configuration Preview :** clés sensibles référencées sous `Gemini_API_Key` et `GROQ_API_KEY` ; leurs valeurs sont masquées par Vercel et n'ont pas été lues. Le code reconnaît maintenant le nom Gemini déjà configuré. Aucun déploiement QA n'existe sur cette branche (liste Vercel : 0).

### Réserves restantes — statut JAUNE

- L'appel réel vers Gemini/Groq n'a pas été exécuté : aucun déploiement QA de cette branche n'est disponible et les valeurs sensibles ne sont pas exposées par les outils. La présence du nom de variable ne prouve ni sa validité ni la réponse du fournisseur.
- La recette DB E2E Replay couvre ACL + appel serveur + mutation + rollback ; elle ne remplace pas l'essai HTTP authentifié de l'API Next.js avec un fichier réel exporté d'un logiciel de pharmacie.
- `npm test` global, typecheck complet `npx tsc --noEmit`, lint et build Next.js non exécutés : le bac isolé ne contient que les fichiers nécessaires au test ciblé, pas le dépôt complet et ses dépendances.
- Défaut découvert lors du contrôle de syntaxe : parenthèse fermante incorrecte dans la construction des candidats de `match/route.ts`, corrigée au commit `cab8b965`; le contrôle ciblé est désormais PASS.
- GitHub Actions : aucun workflow associé au HEAD QA ; status checks vides. Le miroir GitLab ne possède pas cette branche QA.

**Statut : JAUNE — rapprochement et contrôle serveur testés, sécurité RPC corrigée et E2E SQL Replay PASS ; l'appel fournisseur IA réel, la recette HTTP/fichier externe et les contrôles globaux du dépôt restent non prouvés.**

**Périmètre :** changements de code sur QA, migration et données de test sur Replay uniquement ; aucune écriture Supabase Production, aucun changement de configuration de clé, aucun déploiement.
