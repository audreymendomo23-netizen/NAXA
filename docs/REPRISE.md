# NAXA — Reprise opérationnelle consolidée

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
- La migration source `migration_059_pos_ticket.sql` échoue sur `row_number() over (...)` dans un `UPDATE` (PostgreSQL 42P20). Après correction temporaire exclusivement dans la base de test, elle échoue aussi sur `setval(..., 0)` lorsque la table `ventes` est vide (22003). Le fichier source n'a pas été modifié. Une variante corrigée a été appliquée sous un nom de diagnostic distinct pour poursuivre le contrôle des migrations suivantes ; la base de test n'est donc plus un rejeu canonique propre et doit être recréée/réinitialisée avant la preuve finale.
- Migrations source 051 à 058, puis 060 à 065 appliquées à la base de test ; la variante diagnostique 059 a permis de poursuivre. Cela ne constitue pas une preuve que le rejeu CircleCI de la branche source passe.
- 32 fichiers de tests SQL candidats exécutés individuellement : 18 sans erreur SQL remontée par le connecteur, 13 en erreur/assertion, 1 bloqué par le contrôle de sécurité de l'outil. Ces résultats individuels ne remplacent pas le runner `psql -v ON_ERROR_STOP=1` ni la preuve de la suite complète.
- Échecs observés : test 018 sans fixtures (2 profils + 3 pharmacies attendus) ; test 019 avec deux assertions en échec ; test 020 autorisations avec fixture insuffisante ; test 020 caisse avec « C10 architecture non effective » ; plusieurs tests Promoteur (026, 027, 029, 030, 031, 033, 035, 036, 039) échouent sur une contrainte CHECK de `profiles`.
- Contradiction de schéma confirmée sur `profiles` : contraintes simultanées `profiles_fonction_interne_check` (catalogue étendu) et `profiles_fonction_interne_ck` (limite à `responsable`), ainsi que deux contraintes de niveau hiérarchique aux plages différentes. La correction doit être additive et testée ; aucune migration déjà appliquée en Production n'a été modifiée.
- Alerte de sécurité sur la base de test : RLS désactivée sur `public.abonnements` et `public.naxa_architecture_niveaux`. Aucune activation automatique effectuée, car les politiques d'accès doivent être examinées avant de risquer un verrouillage ou une exposition.
- Les migrations source 051–063 ne sont pas présentes comme fichiers correspondants dans la branche d'intégration examinée, alors que les fichiers 064/065 y sont présents. Leur absence doit être réconciliée avant de prétendre que la consolidation couvre tout le POS/assurance/trésorerie/crédit/offline/rappel de lots.

**Action bloquante :** ne pas créer ni pousser le commit final sur `main). Il faut corriger ou remplacer de façon autorisée la migration candidate 059 défectueuse, ajouter une correction additive pour les contraintes contradictoires, rendre les tests de comportement autonomes, puis recréer une base de test propre et rejouer la chaîne exacte ainsi que les 52 tests. Aucun déploiement Production n'a été effectué.
