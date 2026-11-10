# Registre de clôture et de reprise — NAXA (branche de vérification)

> **Document obligatoire à lire avant chaque nouvelle conversation ou session d'agent NAXA.**
> Branche active des vérifications : `qa/e2e-stabilisation-20261106`.
> Dernier HEAD actuel après mise à jour documentaire QA : `950f6943507203f2fdb1adf22e4d80757aed7965`.
> Dernier commit de code/tests avant les commits de gouvernance documentaire : `d93e1000be26705c1feefd543da904c0bd7c8ec9` — `test(core): assert full FK index coverage`, daté du 09/11/2026 à 23:43:57 UTC.

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

- HEAD QA actuel après les commits de gouvernance documentaire : `950f6943507203f2fdb1adf22e4d80757aed7965`.
- Dernier commit de code/tests précédant les seuls commits documentaires de gouvernance : `d93e1000be26705c1feefd543da904c0bd7c8ec9` — `test(core): assert full FK index coverage` (09/11/2026 23:43:57 UTC).
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
