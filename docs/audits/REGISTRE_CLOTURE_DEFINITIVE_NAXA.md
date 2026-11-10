# Registre de clôture définitive NAXA

> **Document de référence obligatoire pour toute reprise NAXA.**
> Dépôt : `audreymendomo23-netizen/NAXA` · branche unique : `main`.
> État initial du registre : 10/11/2026. Dernier HEAD vérifié à l'ouverture : `3edc5bbd0b11592909e40c99ee8ac606a312941d`.

## 1. Règle impérative de reprise — aucune conversation ne commence à zéro

Avant toute analyse, commande, modification ou proposition technique sur NAXA, tout assistant, agent ou intervenant doit :

1. Lire intégralement `AGENTS.md`.
2. Lire intégralement le présent fichier.
3. Lire `STATUT.md`. Le présent registre contient le checkpoint technique de reprise. Lire en plus tout autre document de continuité/reprise uniquement s'il est explicitement référencé par `AGENTS.md` ou l'index du projet et effectivement présent sur `main`.
4. Pour une mission Audit 360, lire aussi `docs/audits/AUDIT_360_ADMINISTRATEUR_NAXA.md` et le mandat CTO en vigueur.
5. Vérifier le HEAD réel de `main`, puis le comparer au dernier checkpoint inscrit ci-dessous. Pour un sujet Supabase, vérifier l'environnement et les migrations concernées avant toute action.
6. Reprendre au premier point **OUVERT / JAUNE / BLOQUÉ** pertinent. Ne pas recommencer un lot **CLOS** au seul motif qu'une nouvelle conversation a commencé.

**Condition d'arrêt :** si le registre, `AGENTS.md` ou la source de continuité pertinente est inaccessible, le signaler et ne pas lancer un audit redondant ni modifier le projet à l'aveugle. Ne jamais remplacer cette lecture par un résumé mémoire ou une supposition.

Cette obligation est également prescrite dans `AGENTS.md`. En cas de contradiction, appliquer le mandat utilisateur le plus récent et les règles de sécurité, puis corriger la documentation de gouvernance.

## 2. Autorité, périmètre et règles immuables

- Source de vérité : dépôt GitHub privé `audreymendomo23-netizen/NAXA`, branche `main` uniquement.
- Aucun branchement, aucune PR. Les changements autorisés sont intégrés directement sur `main`.
- Aucun déploiement ni relancement, aucune migration ni écriture Supabase Production sans autorisation explicite et périmètre compatible avec le mandat actif.
- En audit 360 régi par le NAXA-MANDAT CTO : pas de déploiement, y compris Preview.
- Environnement de tests SQL documenté dans ce registre : Supabase Replay `pwfftcsjyeibxxqhwysw`, jamais à confondre avec Production.
- Les décisions métier définissent le résultat attendu ; elles ne prouvent pas son implémentation.
- Aucun statut vert sans preuve effective. Distinguer systématiquement code présent, test exécuté, CI/build, recette utilisateur et Production.

## 3. Statuts et règle anti-répétition

| Statut | Signification | Conduite |
|---|---|---|
| **CLOS — preuve acquise** | Critère précis réussi, avec environnement, test et commit identifiés | Ne pas relancer le même test. Réutiliser la preuve. |
| **VERT CIBLÉ** | Le sous-critère indiqué est démontré, sans certifier le module entier | Garder le périmètre exact dans tout rapport. |
| **JAUNE** | Code/statique ou test partiel ; preuve d'exécution ou critère restant | Traiter la réserve précise, pas les lots clos. |
| **ROUGE** | Défaut reproduit ou preuve contradictoire | Corriger la cause racine et retester le scénario affecté. |
| **BLOQUÉ** | Dépendance externe, permission, outil ou environnement indisponible | Terminer les travaux indépendants ; nommer le blocage exact. |
| **NON ÉVALUÉ** | Pas de test ou d'inspection suffisants | Ne pas inférer un résultat. |

Un lot **CLOS** ne peut être rouvert que si au moins un déclencheur est vrai :
- un changement touche le code, la migration, le schéma, la policy, la RPC, le contrat ou la configuration qui fondait sa preuve ;
- une régression liée est observée ;
- l'environnement de preuve a été réinitialisé ou a dérivé de façon pertinente ;
- l'utilisateur demande explicitement une nouvelle validation ;
- un contrôle plus large révèle une contradiction précise qui invalide la preuve.

Toute réouverture doit inscrire le déclencheur, l'ancien SHA de preuve, le nouveau SHA testé et le résultat. Une simple nouvelle conversation, un nouveau modèle ou un compteur Advisor inchangé **n'est pas** un déclencheur.

## 4. Registre des lots et preuves

Les statuts ci-dessous portent uniquement sur les critères nommés. Ils ne certifient pas l'application entière.

| ID | Lot / critère exact | Environnement | Preuve / test exact | Version source de référence | Statut |
|---|---|---|---|---|---|
| SEC-LOG-01 | Les anciennes RPC publiques `log_recherche(text[])` et `log_evenement(...)` ne sont plus exécutables par `anon` ni `authenticated`; exécution conservée à `service_role` | Replay `pwfftcsjyeibxxqhwysw` | Test `supabase/tests/20261109235840_restrict_legacy_public_search_logging_execution.sql` ; ACL relues après correction : anon=false, authenticated=false, service_role=true ; finding Advisor anon SECURITY DEFINER correspondant disparu | Migration `supabase/migrations/20261109235840_restrict_legacy_public_search_logging_execution_20261110.sql`, présente sur `main` au checkpoint `3edc5bb` | **CLOS — preuve ciblée** |
| SEC-ADMIN-02 | `private.is_admin()` retourne toujours un booléen non NULL ; un Admin inactif est refusé par les gardes contrôlés | Replay | `supabase/tests/269_admin_exam_services_active_guards.sql` : **PASS — 33 assertions structurelles et comportementales** ; refus Admin inactif pour les RPC couvertes | Migration `20261110000324_admin_is_admin_boolean_false_for_inactive_20261110.sql` et test versionnés sur `main` au checkpoint `3edc5bb` | **CLOS — preuve ciblée** |
| SEC-PROFILE-03 | Un Promoteur dont la validité canonique est expirée ne peut plus lire/modifier les profils enfants ; accès anonyme refusé | Replay | `supabase/tests/20261110012000_profiles_rls_active_promoter_scope.sql` : **PASS — active read 1, expired read/update 0, anon read 0** ; fixtures annulées par ROLLBACK | Migration `20261110012000_profiles_rls_active_promoter_scope_20261110.sql` et test versionnés ; fixture Auth corrigée dans le commit final `3edc5bb` | **CLOS — preuve ciblée** |
| ADM-EXAM-READ-01 | Lecture Admin des brouillons/suspendus du catalogue Examens | Replay | `supabase/tests/20261102105542_admin_exam_catalog_active_read.sql` : **PASS — E17** | Source/test présents dans l'historique de `main` au checkpoint | **CLOS — lecture SQL ciblée** |
| ADM-EXAM-PUBLIC-02 | Visibilité publique Examens limitée au partenaire associé, à l'univers et au feature flag | Replay | `supabase/tests/20261102105033_admin_exam_centers_public_scope.sql` : **PASS — E14** | Source/test présents dans l'historique de `main` au checkpoint | **CLOS — lecture SQL ciblée** |
| AUTH-IMPORT-01 | Suppression des imports doubles de `verifierSecuriteMotDePasse` dans création de compte et mot de passe oublié | Source GitHub `main` | Relecture post-écriture : exactement un import par fichier ; appel `await verifierSecuriteMotDePasse(password)` conservé | Commit `e2a415c91d12af8b8ab19dd178584ec42b07229c` | **CLOS — correction statique uniquement** |

### Interprétation obligatoire des clôtures

- SEC-LOG-01 ne certifie pas l'ensemble des RPC de télémétrie ni toutes les fonctions SECURITY DEFINER.
- SEC-ADMIN-02 ne certifie pas toutes les actions Admin : uniquement les gardes/scénarios du test cité.
- SEC-PROFILE-03 ne certifie pas toutes les tables/profils ni l'ensemble des permissions Promoteur.
- ADM-EXAM-READ-01 et ADM-EXAM-PUBLIC-02 sont des preuves SQL ciblées, pas une recette navigateur complète.
- AUTH-IMPORT-01 ne certifie ni l'ensemble du flux Auth, ni le build/lint/typecheck, ni la protection native Supabase contre les mots de passe compromis.

## 5. Réserves connues à reprendre — sans réexécuter les lots clos

| ID | Réserve | État au checkpoint | Action ciblée suivante |
|---|---|---|---|
| AUTH-BREACH-01 | Protection native Supabase contre les mots de passe compromis désactivée (Advisor : `auth_leaked_password_protection`) ; le contrôle applicatif HIBP existe mais ne remplace pas cette configuration native | **JAUNE / non clos** | Identifier l'environnement concerné et activer/valider uniquement avec les droits et autorisations appropriés ; tester le parcours Auth ensuite |
| SEC-DEFINER-REVIEW | Advisor signalait 185 fonctions SECURITY DEFINER exécutables par authenticated. Ce nombre est un inventaire d'alertes, pas 185 vulnérabilités prouvées | **À qualifier** | Classer par fonction/signature, ACL et garde interne ; prioriser les fonctions mutatrices/sensibles ; ne pas retirer massivement les droits |
| RLS-NO-POLICY | Advisor signalait 43 tables RLS sans policy. Une table RLS sans policy est deny-by-default pour les rôles soumis à RLS ; les grants et usages `service_role` restent à classifier | **À qualifier** | Vérifier grants, exposition API et besoin métier table par table ; ne pas créer de policies permissives par défaut |
| RLS-PERMISSIVE | Advisor performance signalait 31 occurrences de policies permissives multiples après nettoyage des policies `profiles` | **À qualifier** | Examiner les rôles/opérations/expressions qui se recouvrent ; pas un défaut de sécurité par compteur seul |
| ADM-STEP13 | Le test `supabase/tests/20261102014000_admin_global_accounts_pilotage.sql` n'a pas été exécuté avec succès ; tentative bloquée par les contrôles de sécurité des outils. Les métriques Replay observées étaient cohérentes avec les données démo/vides, mais cela ne valide pas le test d'acceptation | **JAUNE** | Exécuter le test sur Replay via un moyen autorisé ou établir un scénario alternatif équivalent avec preuve |
| ADM-UI-RUNTIME | Pages/fichiers de files Admin Prestations et réservations Marketplace identifiés dans le code ; preuve de rendu et d'usage navigateur non acquise dans ce checkpoint | **JAUNE** | Vérifier le parcours runtime sur environnement accessible, sans répéter les tests SQL E14/E17 |
| ADM-EXAM-LIMITS | Page Examens possède des plafonds de lecture (centres, services, packs, rendez-vous) ; pagination/complétude au-delà de ces limites non démontrée | **JAUNE** | Vérifier UX et pagination attendue ; ne pas refaire E14/E17 sauf changement des policies/RPC concernées |
| DB-MIGRATION-SYNC | Comparaison Replay / dépôt : 30 migrations datées du 09/11/2026 trouvées dans Replay, une source correspondante dans l'arbre `main`, soit 29 sources non retrouvées dans `main` lors de cet instantané | **ROUGE — écart de traçabilité** | Faire l'inventaire exact des noms/versions et réconcilier sans réappliquer aveuglément ; vérifier les dépendances et l'origine de chaque migration |
| CI-HEAD | Le miroir GitLab observé était en retard par rapport à GitHub `main`. Les pipelines GitLab récents observés concernaient `test-storage-binary`, pas la validation complète du HEAD GitHub. Le dernier statut CircleCI vu concernait un commit antérieur et était pending ; quota mensuel signalé épuisé | **NON ÉVALUÉ sur le HEAD du checkpoint** | Ne pas interpréter un ancien pipeline comme validation de `3edc5bb`. Réévaluer uniquement si CI fait partie du critère actif et si un runner adapté est accessible |
| BUILD-STATIC | Build complet, lint et typecheck non exécutés sur le HEAD du checkpoint | **NON ÉVALUÉ** | Les exécuter en fin de lot ou lorsqu'une preuve build est explicitement requise ; ne pas prétendre qu'ils sont verts |
| E2E-NODE | Recette E2E via Node.js exclue du périmètre de travail demandé à ce checkpoint | **HORS CRITÈRE déclaré** | Ne pas la relancer sauf réintégration explicite au périmètre |

### Lecture des Advisors (instantané Replay)

Dernier instantané connu après la correction RLS profils :
- `rls_enabled_no_policy` : 43 (INFO).
- `authenticated_security_definer_function_executable` : 185 (WARN).
- `auth_leaked_password_protection` : 1 (WARN).
- Le finding `anon_security_definer_function_executable` correspondant aux deux RPC de journalisation a disparu après correction.
- `multiple_permissive_policies` : 31 (WARN performance).
- `unindexed_foreign_keys` : 146 (INFO).
- `unused_index` : 192 (INFO).

Ces nombres sont un instantané, non une liste de défauts démontrés. Ne pas relancer intégralement les mêmes inspections pour reproduire ces compteurs. Les variations de compteurs seules ne rouvrent pas un lot ; qualifier les objets modifiés ou les alertes nouvellement apparues.

## 6. Décalage de migrations — règle spécifique

Le constat des 29 sources manquantes concerne l'instantané Replay comparé à `main` au 10/11/2026. Il n'autorise pas à recréer ou réappliquer ces migrations à l'aveugle.

Avant toute correction :
1. Comparer chaque version Replay à tous les fichiers SQL et à l'historique Git.
2. Identifier les migrations manquantes, renommées, fusionnées ou appliquées hors dépôt.
3. Vérifier l'ordre, les dépendances, les objets réellement présents et les effets latéraux.
4. Restaurer la traçabilité dans `main` sans duplicata d'horodatage ni effet non idempotent.
5. Tester uniquement sur Replay, avec transaction/rollback lorsque pertinent.
6. Ne pas toucher à Production sans autorisation explicite.

## 7. Checkpoint de reprise

- Dernier HEAD `main` vérifié : **`3edc5bbd0b11592909e40c99ee8ac606a312941d`**.
- Commit précédent notable : `d94c283f2c217d17e7ce78c5d31db1ee846c190c` (migration et test RLS profils) ; le commit `3edc5bb` corrige la fixture Auth et fait passer le test exact.
- Environnement Replay de référence : `pwfftcsjyeibxxqhwysw`.
- Dernières preuves fermées : SEC-LOG-01, SEC-ADMIN-02, SEC-PROFILE-03, ADM-EXAM-READ-01, ADM-EXAM-PUBLIC-02, AUTH-IMPORT-01.
- Prochaine reprise utile : attaquer une réserve du §5, en priorité DB-MIGRATION-SYNC ou un point Admin encore jaune selon le mandat actif. Ne pas rejouer les tests du §4 sans déclencheur de réouverture.
- **Production :** aucune migration, écriture de données ou déploiement n'a été effectué dans la passe documentée par ce checkpoint.

## 8. Fiche obligatoire pour tout nouveau lot

Copier cette fiche dans le registre avant ou pendant la validation du lot ; la remplir à partir des résultats réels.

| Champ | Valeur à consigner |
|---|---|
| ID stable | |
| Lot / critère d'acceptation précis | |
| Cause racine / contradiction observée | |
| Environnement exact (Replay/Preview/Production/local) | |
| Commit source testé | |
| Migration(s) fichier + version réellement appliquée | |
| Test exact / commande / endpoint exécuté | |
| Résultat brut ou preuve vérifiable | |
| Rollback / résidus contrôlés, si applicable | |
| Statut (CLOS / VERT CIBLÉ / JAUNE / ROUGE / BLOQUÉ / NON ÉVALUÉ) | |
| Réserves restant hors du critère | |
| Déclencheurs de réouverture | |

Une clôture doit être datée et rattachée à un commit. Les résultats négatifs, erreurs d'outil et tests non exécutés doivent être consignés comme tels, jamais transformés en PASS.

## 9. Format de rapport à chaque reprise

Rapport bref, en français :
- **État :** checkpoint et lot réellement repris.
- **Fait :** correction/inspection effectuée.
- **Preuve :** SHA, environnement, test et résultat exact.
- **Reste :** réserves ouvertes uniquement.
- **Suite :** action concrète suivante.

Ne pas réimprimer tout le registre dans chaque réponse. Citer les IDs de lots et les changements depuis le dernier checkpoint.
