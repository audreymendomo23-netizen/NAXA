# NAXA — Reprise opérationnelle consolidée

> **Archive historique du 09/10/2026 :** les états de branche, de Production et de CI décrits ci-dessous sont une photographie ancienne. Pour toute reprise actuelle, appliquer `AGENTS.md` sur `main` et consulter `docs/CONTINUITE_IA_NAXA.md`, `STATUT.md` et `FONCTIONNALITES_VALIDEES.md`. Les anciennes consignes interdisant toute modification de `main` ou imposant des branches/PR sont remplacées par `AGENTS.md`.

Dernière mise à jour : 9 octobre 2026.

## Source de vérité et garde-fous
- Dépôt : `audreymendomo23-netizen/NAXA`.
- Référence Production actuelle : `main`, commit `219b8c1711a8e3781bde4ed43c23815a3998e8be`.
- Branche de chantier : `integration/naxa-360-20261009`.
- Ne jamais modifier ou fusionner dans `main` sans autorisation explicite.
- Aucun changement Supabase Production ni déploiement avant autorisation explicite « OUI, DÉPLOIE ».
- Ne jamais afficher de secret, demander de capture, ni reconstruire une fonctionnalité simplement parce que sa preuve manque.

## Diagnostic consolidé
1. La branche de rejeu inventorie 78 migrations et 52 tests, mais l'exécution complète n'est pas prouvée.
2. Le rejeu sur `naxa-ci-replay-2` est incomplet; l'arrêt de l'outil sur la migration 051 ne prouve ni succès ni échec SQL.
3. Le schéma Production observé ne contient pas plusieurs objets caisse/vente/consultation/prescription appelés par le code candidat.
4. La RPC de réservation doit imposer le contrôle d'âge indépendamment de l'interface.
5. La fonction de transition de réservation doit préserver l'intégrité statut/paiement/stock.
6. La portée d'écriture du catalogue produit doit respecter la règle d'administration confirmée.
7. Les configurations CI existantes ne prouvent pas l'exécution complète des migrations et des tests.
8. Le README et le STATUT historiques contiennent des instructions et déclarations incohérentes; voir la mise à jour du chantier.

## Exécution simultanée
Traiter dans un seul chantier coordonné :
- Réconciliation sélective des meilleures versions à partir de `main`, sans fusion aveugle des branches divergentes.
- Corrections SQL additives et tests de sécurité en base de test.
- Rejeu complet de la chaîne candidate et exécution de l'intégralité des tests.
- Réparation de CI et preuves rattachées au SHA de la branche de chantier.
- Tests des parcours client, pharmacie, caisse, pharmacien, promoteur et administration.
- Mise à jour continue de `README.md`, `STATUT.md`, de ce document et du registre fonctionnel.

## Critères de vert
- Aucun test ignoré ou prétendu exécuté sans résultat.
- Toutes les migrations attendues appliquées dans le bon ordre sur l'environnement de test.
- Suite SQL complète réussie, plus tests négatifs de sécurité.
- Build, lint et TypeScript réussis sans interaction manuelle.
- Contradictions code ↔ schéma identifiées et résolues pour les parcours livrés.
- Aucun blocage critique/majeur non résolu.
- Les preuves mentionnent branche, commit, commande/contrôle et résultat.

## État actuel
**ROUGE / NO-GO Production.** Les corrections et validations se poursuivent en parallèle sur la branche de chantier. Aucune modification de Production n'a été faite par ce chantier.


## Consolidation des versions candidates — 9 octobre 2026
La branche `integration/naxa-360-20261009` contient désormais une consolidation sélective issue de `ci/replay-rewrite-20261008` : registre fonctionnel, parcours Client/Caisse/Pharmacien/Pilotage, administration de validité, composants partagés, documentation métier, migrations additives candidates et tests SQL additionnels. La configuration CircleCI de rejeu (78 migrations attendues et 52 tests) a aussi été reprise.

Cette consolidation est **une intégration de fichiers sur une branche isolée**, pas une validation d’exécution. Le schéma `supabase/schema.sql` et les migrations historiques modifiées dans la branche source n’ont pas été remplacés; les migrations candidates ne doivent pas être appliquées à Production. Le contrôle CircleCI sur le nouveau SHA n’a pas encore de statut disponible. Le chantier reste **ROUGE / NO-GO Production** tant que le rejeu complet, les 52 tests, build/lint/TypeScript et les parcours intégrés ne sont pas réellement exécutés avec preuves.


## Vérification SQL ciblée — 9 octobre 2026, session de reprise
**Résultat : ROUGE / NO-GO MAIN.** Contrôles effectués sur la base de test isolée `naxa-ci-replay-2` (projet `pwfftcsjyeibxxqhwysw`), jamais sur Supabase Production.

- Historique SQL observé avant rejeu complémentaire : 62 entrées de migration.
- La migration source `migration_059_pos_ticket.sql` échoue sur `row_number() over (...)` dans un `UPDATE` (PostgreSQL 42P20). Après correction temporaire exclusivement dans la base de test, elle échoue aussi sur `setval(..., 0)` lorsque la table `ventes` est vide (22003). Au moment de cet audit initial, le fichier source n'avait pas encore été modifié ; il a depuis été corrigé sur la branche d’intégration. Une variante corrigée a été appliquée sous un nom de diagnostic distinct pour poursuivre le contrôle des migrations suivantes ; la base de test n'est donc plus un rejeu canonique propre et doit être recréée/réinitialisée avant la preuve finale.
- Migrations source 051 à 058, puis 060 à 065 appliquées à la base de test ; la variante diagnostique 059 a permis de poursuivre. Cela ne constitue pas une preuve que le rejeu CircleCI de la branche source passe.
- 32 fichiers de tests SQL candidats exécutés individuellement : 18 sans erreur SQL remontée par le connecteur, 13 en erreur/assertion, 1 bloqué par le contrôle de sécurité de l'outil. Ces résultats individuels ne remplacent pas le runner `psql -v ON_ERROR_STOP=1` ni la preuve de la suite complète.
- Échecs observés : test 018 sans fixtures (2 profils + 3 pharmacies attendus) ; test 019 avec deux assertions en échec ; test 020 autorisations avec fixture insuffisante ; test 020 caisse avec « C10 architecture non effective » ; plusieurs tests Promoteur (026, 027, 029, 030, 031, 033, 035, 036, 039) échouent sur une contrainte CHECK de `profiles`.
- Contradiction de schéma confirmée sur `profiles` : contraintes simultanées `profiles_fonction_interne_check` (catalogue étendu) et `profiles_fonction_interne_ck` (limite à `responsable`), ainsi que deux contraintes de niveau hiérarchique aux plages différentes. La correction doit être additive et testée ; aucune migration déjà appliquée en Production n'a été modifiée.
- Alerte de sécurité sur la base de test : RLS désactivée sur `public.abonnements` et `public.naxa_architecture_niveaux`. Aucune activation automatique effectuée, car les politiques d'accès doivent être examinées avant de risquer un verrouillage ou une exposition.
- Les fichiers de migrations source 051–065 sont bien présents dans la branche d'intégration. En revanche, l'historique de la base de test était arrêté au socle 050 : les migrations 051–058 et 060–065 ont donc été appliquées manuellement pour poursuivre le diagnostic, avec une variante temporaire de 059 uniquement en base de test. Le fichier source 059 a été corrigé sur la branche d’intégration (commit `23bc21dab4ab4daaa8f5b818dd2f1015edb1ae53`) : `row_number()` déplacé dans un CTE avant UPDATE et `setval()` rendu sûr sur table vide. Test ciblé réussi sur la base de test de diagnostic (`setval` puis `nextval() = 1`) ; le rejeu complet sur une base propre reste à prouver.

**Action bloquante :** ne pas créer ni pousser le commit final sur `main). Il faut corriger ou remplacer de façon autorisée la migration candidate 059 défectueuse, ajouter une correction additive pour les contraintes contradictoires, rendre les tests de comportement autonomes, puis recréer une base de test propre et rejouer la chaîne exacte ainsi que les 52 tests. Aucun déploiement Production n'a été effectué.


## Reprise du chantier SQL — 10 octobre 2026 (validation toujours bloquée)

- Corrections de tests poussées sur la branche d'intégration uniquement : test 018 réordonné et rendu exécutable sur la base de diagnostic ; test 033 utilise désormais des assertions explicites au lieu d'une division par zéro ; tests 035 et 036 émettent un marqueur PASS explicite.
- Exécution ciblée confirmée sur la base de diagnostic : 018_pilotage_canonique_scope, 033_promoteur_pilotage_hors_scope_8, 035_promoteur_session_audit_behavior, 036_promoteur_session_audit_rls et 066_profiles_constraints_rls_hardening ont renvoyé leurs marqueurs PASS. Le test 019 doit encore être relu assertion par assertion ; un retour sans erreur SQL n'est pas une preuve suffisante.
- La migration candidate 067 a été ajoutée à la branche pour corriger les vérifications de capacités de lecture sans profil cible et faire appliquer la validité canonique du Promoteur (convention + abonnement réseau). Le test 066 vérifie désormais ces deux contrats et passe sur la base de diagnostic.
- Les tests 026/027/031/033/039 ont fait l'objet de corrections de fixtures ou d'assertions. Ils ne sont pas tous démontrés verts après les dernières modifications ; ne pas extrapoler les succès ciblés à toute la suite.
- Le dernier contrôle GitHub du commit testé ne retourne aucun statut CI ni workflow run. La branche d'intégration reste en avance sur main (comparaison courante : 165 commits, 103 fichiers) ; aucun commit de synthèse n'a été poussé sur main.
- La base naxa-ci-replay-2 reste une base de diagnostic modifiée manuellement : elle n'est pas une preuve de rejeu exact. Il faut recréer une base de test propre, appliquer les migrations de la branche dans l'ordre exact, puis exécuter la suite complète de 52 tests et obtenir un résultat CI traçable.
- Les contradictions de contraintes profiles et l'alerte RLS sur public.abonnements / public.naxa_architecture_niveaux restent à résoudre et à vérifier sur le rejeu propre.
- État : ROUGE / NO-GO MAIN. Production n'a pas été modifiée ni redéployée. Garder le verrou main jusqu'à la preuve CI + SQL complète.


## Reprise simultanée — corrections de causes racines — 10 octobre 2026

- **Cause racine trouvée dans le bootstrap SQL :** `supabase/schema.sql` contenait 101 784 caractères, 13 définitions de plusieurs fonctions de base et 13 déclarations du trigger d'inscription, ainsi que des blocs PL/pgSQL mal délimités. Il a été restauré depuis la version canonique initiale (`bbf55b6c30395b9593d52eb774be136e13050a5a`) : 10 032 caractères, une seule définition de `my_pharmacie()`, `restore_stock()`, `expire_reservations()` et du trigger attendu. Cela corrige le bootstrap candidat, **sans écriture Production**.
- **Migration POS 059 reconstruite sur la branche d'intégration :** suppression des fragments dupliqués/coupés, numérotation historique via CTE, index unique, séquence recalée sans échec lorsque `ventes` est vide, et une seule définition de `vente_ticket(uuid)`. L'application diagnostique de cette version à `naxa-ci-replay-2` a réussi. La migration déjà appliquée en Production n'a pas été rejouée sur Production.
- **Migration candidate 067 :** appliquée à l'environnement diagnostique sous un nom de migration explicite pour valider les fonctions de capacités de lecture et la validité commerciale réseau. L'historique de cet environnement contient aussi des patches diagnostiques; il n'est donc toujours **pas une base propre de preuve**.
- **Comptages du harnais confirmés dans l'arbre Git courant :** 79 migrations source et 53 tests SQL, conformes aux nombres attendus dans `.circleci/config.yml`.
- **Tests ciblés réexécutés sur la base diagnostique :** 018 (marqueur PASS), 019 (16/16 assertions vraies), 026 (13 assertions), 027 (11 assertions), 031 (pass=true), 033 (PASS transactionnel), 036 (marqueur PASS), 039 (PASS transactionnel) et 066 (marqueur PASS). Le test 035 a été bloqué lors de la tentative courante par le contrôle de sécurité de l'outil; son marqueur PASS antérieur n'est pas remplacé par cette tentative bloquée.
- **CI toujours non prouvée :** pour le HEAD contrôlé après les corrections (`9ec8f523e37dbdc25cea41b9616a7e7335b43f13`), GitHub ne retourne aucun statut de contrôle ni workflow run. La présence du harnais CircleCI ne prouve pas qu'il a été exécuté.
- **Limite restante obligatoire :** effectuer le rejeu exact sur une base locale/CI propre, puis obtenir la réussite de tous les 53 tests SQL et du job qualité. Les succès ciblés sur la base diagnostique ne remplacent pas cette preuve.

**Décision : ROUGE / NO-GO MAIN maintenu.** Aucun commit sur `main`, aucune PR/fusion vers `main`, aucune écriture Supabase Production et aucun déploiement. La branche de travail reste `integration/naxa-360-20261009`.


## Suite du chantier simultané — portée hiérarchique et gates CI — 10 octobre 2026

- **Migration additive 068 ajoutée** : `supabase/migration_068_hierarchical_pharmacy_scope.sql` corrige le défaut commun qui empêchait les Responsables/Caisses d'accéder au scope de leur pharmacie via l'ancien `my_pharmacies()`, limité au Promoteur. Le scope individuel est borné à la pharmacie du profil et à un Promoteur parent présent dans le réseau avec convention + abonnement valides. Les scopes RESEAU et POSTE_CAISSE restent contrôlés. La migration 068 a été appliquée et testée sur l'environnement diagnostique, pas en Production.
- **Contradiction corrigée dans le test 027** : l'expiration commerciale doit fermer le scope pharmacie du Promoteur, pas laisser le scope ouvert. Après alignement, le test 027 a renvoyé `GREEN` avec 11 assertions.
- **Test 018b reconstruit comme scénario autonome** : trois comptes de test, Promoteur et abonnement réseau valides, architecture A3, privilège Responsable, puis vérification du périmètre. Il a renvoyé `018b Responsable — PASS transactionnel` après la migration 068.
- **Harnais CI synchronisé** : l'arbre Git contient désormais exactement 80 migrations source et 53 tests SQL ; `.circleci/config.yml` attend 80 et 53. Les tests structurels 017, 020_architecture_privileges, 020_caisse_perimetre (20 assertions), 023b et 034 (6/6 assertions) ont reçu des marqueurs de sortie exploitables par le runner ; 041b a également un marqueur PASS.
- **Autres résultats ciblés après correction** : 000, 018, 019 (16/16 assertions), 026 (13 assertions), 029, 031, 033, 036, 039, 040 et 066 ont renvoyé un résultat positif sur la base diagnostique. Le test 024 a été réordonné pour créer convention et abonnement avant le lien réseau, mais la dernière tentative de réexécution a été bloquée par les contrôles de l'outil. Les tests 013, 023, 028 et 032 n'ont pas pu être réexécutés par ce connecteur; le scénario 020_authorisation a été rendu autonome mais sa tentative d'exécution a également été bloquée. Ces cas ne sont pas déclarés verts.
- **RLS de diagnostic revérifiée** : `abonnements` RLS=true avec une politique; `naxa_architecture_niveaux` RLS=true avec deux politiques. Cela ne remplace pas une vérification issue d'un rejeu propre.
- **État CI du HEAD `07562da8b6b375297be0b319d5b1bf975dbb23d3`** : aucun statut GitHub ni workflow run retourné. La CI reste sans preuve d'exécution concluante. La branche est en avance sur `main`, sans retard; `main` n'a pas été modifiée.

**Décision : ROUGE / NO-GO MAIN maintenu.** Les corrections de causes racines et plusieurs tests ciblés sont positifs, mais le rejeu exact sur base propre et la réussite de toute la suite SQL/qualité restent obligatoires. Aucun changement Supabase Production, aucune fusion et aucun déploiement.


## CI CircleCI — correctif initial sur branche de travail

- **Lu dans les fichiers de `main`** (HEAD `4c75dd41fcda6f7486e0afdc90971f809c6d3ea8`) : `.circleci/config.yml` contenait cinq ouvertures heredoc littérales non échappées (`<<'PY'`, `<<'EOF'`, `<<'SQL'`).
- **Correctif proposé** sur `fix/ci-main` : les cinq marqueurs sont maintenant écrits `\\<<` pour empêcher leur interprétation par le moteur de configuration CircleCI. Aucune migration SQL existante n'a été modifiée.
- **Contrôles lus dans le fichier** : les invocations `psql` utilisent déjà `-v ON_ERROR_STOP=1`; les listes de migrations/tests utilisent `LC_ALL=C sort`; le filtre rejette une sortie vide et les valeurs booléennes fausses (`f`/`false`). Ces contrôles structurels ne prouvent pas l'exécution des jobs.
- **Prouvé par exécution** : aucun job CI n'est encore déclaré vert à ce stade; attendre les statuts et logs du pipeline déclenché par la PR.
- **Prochaine action** : ouvrir une PR `fix/ci-main` → `main`, puis relever le pipeline CircleCI, `quality` et `sql_tests`, avec le premier message d'erreur exact si échec.
