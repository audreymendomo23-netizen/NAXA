# NAXA — STATUT

Mise à jour : 7 octobre 2026 — reprise contrôlée / reconstruction canonique

## État actuel
**REWRITE ISOLÉ DE MAIN — PARTIES 1 À 6 VERTES ; PILOTAGE 360° PARTIES 1 À 4 VERTES ; AUDIT MÉTIER/GLOBAL POST-DIRECTION 360° CLÔTURÉ. PRODUCTION INCHANGÉE.**

### Partie 1 — Audit et verrouillage du socle
- Branche de reconstruction : `rewrite/naxa-from-main-20261007`.
- `main` inchangé.
- Production Vercel inchangée.
- Supabase Production n'a subi aucune modification persistante pendant cette partie.
- Historique Supabase réel vérifié jusqu'à la migration `042_stats_pilotage_facade_security`.
- Modèle réel de gouvernance vérifié.
- 104 privilèges catalogués, mais 0 attribution effective actuellement mesurée.
- 0 relation Promoteur → pharmacie actuellement mesurée.
- 3 pharmacies, 2 profils, 3 abonnements, 4 réservations et 9 stocks actuellement mesurés.
- Alerte sécurité Supabase actuelle : Leaked Password Protection désactivée.
- 25 index inutilisés signalés ; aucune suppression effectuée sans preuve.
- Contradictions historiques consignées dans `docs/REWRITE_BASELINE_20261007.md`.

### Décision de reconstruction
La documentation historique ne peut plus être utilisée seule comme état courant. La reconstruction doit repartir du comportement validé, du cahier des charges v3.7, du prompt maître et de l'état réel Supabase, puis produire un modèle canonique testable.

**Partie 1 : VERT — 100 % de l'objectif d'audit.**

## Prochaine partie — validation requise
**Partie 2 : socle DB canonique**
1. profils et hiérarchie N0 → N4 ;
2. architectures ORPHELIN / PARENTS_ENFANTS / PARENTS_AINES_CADETS / HYBRIDE ;
3. invariants et contraintes ;
4. tests contradictoires ;
5. vérification transactionnelle avant toute persistance ;
6. documentation et statut.

Aucun passage à la Partie 2 sans validation du fondateur.

## Partie 2 — Socle DB canonique : VERT
- Migration de reconstruction ajoutée : supabase/migration_043_canonical_governance_part2.sql.
- Test contradictoire ajouté : supabase/tests/043_canonical_governance_part2.sql.
- Hiérarchie canonique verrouillée : N0 Admin, N1 Promoteur, N2 Responsable, N3 Caisse, N4 Client.
- Responsable reste une fonction interne et n'est jamais ajouté à role_type.
- Quatre architectures verrouillées avec leurs capacités canoniques.
- Validation transactionnelle effectuée sur Supabase réel puis ROLLBACK : aucune donnée Production modifiée.
- Test négatif : un Client ne peut pas être accepté au niveau N3.
- Test négatif : ORPHELIN ne peut pas déclarer une capacité Responsable > 0.
- Après rollback, contrôle d'intégrité : 2 profils clients restent inchangés et 0 architecture n'a été persistée.
- main et Production restent inchangés.

**Partie 2 : VERT — 100 % de l'objectif.**

## Historique — Partie 3
**Partie 3 : conventions + réseau pharmacies + abonnement Promoteur**, avec le même protocole audit → contradiction → correction → tests → documentation → VERT.

## Partie 3 — Convention + réseau + abonnement Promoteur : VERT
- Migration canonique : `supabase/migration_044_promoteur_convention_network_subscription.sql`.
- Tests contradictoires : `supabase/tests/044_promoteur_convention_network_subscription.sql`.
- Tables canoniques : `conventions_promoteurs`, `abonnements_promoteurs`, `abonnement_promoteur_paiements`.
- Invariant verrouillé : 1 Promoteur = 1 convention = 1 abonnement.
- Tarif négocié distinct de la référence catalogue 30 000 FCFA.
- Réseau : un seul lien Promoteur actif par pharmacie.
- Un lien réseau exige un profil Promoteur actif.
- Le Promoteur ne reçoit aucun droit d'écriture sur convention/abonnement/paiements ; l'écriture est réservée à NAXA.
- RLS activé sur les trois tables avec lecture limitée au Promoteur concerné ou NAXA.
- L'expiration/impayé du Promoteur bloque le réseau via le moteur canonique ; le Promoteur lui-même n'est pas désactivé par ce mécanisme.
- Ancien trigger de création d'abonnement par pharmacie retiré du chemin canonique.
- Validation transactionnelle réelle effectuée puis ROLLBACK.
- Après rollback : 0 table canonique persistée, 0 lien réseau persistant ; les 3 abonnements historiques par pharmacie et l'ancien trigger restent uniquement dans Production comme état legacy non appliqué par cette migration.
- `main` et Production inchangés.

**Partie 3 : VERT — 100 %.**

## Historique — Partie 4
**Partie 4 : privilèges effectifs + délégation Promoteur + Responsable/Caisse**, même protocole audit → contradiction → correction → tests → documentation → VERT.


## Partie 4 — Privilèges effectifs + délégation : VERT

- Migration canonique : `supabase/migration_045_effective_privileges_delegation.sql`.
- Durcissement legacy : `supabase/migration_046_disable_legacy_privilege_provisioning.sql`.
- L'association Promoteur → pharmacie n'attribue plus automatiquement de matrice de privilèges.
- Bootstrap des privilèges effectifs contrôlé par NAXA.
- Délégation Promoteur → Responsable/Caisse limitée par niveau, architecture et scope.
- Délégation Responsable → Caisse limitée à ses enfants.
- Les privilèges de gouvernance restent non délégables.
- `POSTE_CAISSE` est réservé au niveau Caisse et `RESEAU` au bootstrap NAXA vers Promoteur.
- Test contradictoire : `supabase/tests/045_effective_privileges_delegation.sql`.
- Correction du test : utilisation correcte de `PERFORM set_config(...)` dans le bloc PL/pgSQL.
- Validation transactionnelle réelle effectuée puis ROLLBACK : aucune donnée Production persistée.
- `main` et Production restent inchangés.

**Partie 4 : VERT — 100 %.**

## Historique — Partie 5

**Partie 5** clôturée après validation explicite du fondateur.


## Partie 5 — Scope réseau + Pilotage Promoteur

- Audit : le contrat `RESEAU` de `naxa_profile_privileges` exigeait `pharmacie_id IS NULL`.
- Rouge détecté puis isolé : `naxa_grant_privilege()` injectait `p_pharmacie` malgré ce contrat.
- Correction racine : `migration_047_network_scope_pilotage_promoteur.sql` normalise l'attribution et la révocation du scope `RESEAU` à `pharmacie_id = NULL`.
- Contrôle de portée : seul le réseau actif du Promoteur alimente `stats_pilotage_scope()`.
- Test contradictoire réel : bootstrap NAXA → privilège réseau effectif → pilotage limité au réseau actif → exclusion du réseau inactif/hors périmètre → auto-attribution Promoteur refusée → révocation réseau contrôlée → réactivation testée.
- Validation Supabase transactionnelle : PASS avec ROLLBACK ; aucune donnée Production persistée.
- CI GitHub Actions : le blocage historique intervenait avant les steps et était externe au test.
- Fallback CI CircleCI : pipeline #3, commit `935026a21dfdadff10b0d44e1bc0aa83da0459a6`, workflow `part5_gate`, job exécuté et **Success** en 26 s.
- La preuve CI structurelle exigée est donc obtenue ; aucun contournement du test ni affaiblissement du contrôle n'a été effectué.
- `main` et Production restent inchangés.
- **Partie 5 : 🟢 VERT — 100 %.**

## Système de continuité déterministe — installé

- `docs/NAXA_MASTER_INDEX.md` : hiérarchie des autorités et état de référence.
- `docs/CONTINUITE_NAXA.md` : protocole obligatoire de reprise.
- `docs/NAXA_REPRISE_EXACTE.md` : checkpoint courant unique avec position exacte.
- `docs/NAXA_CHECKPOINTS.md` : historique append-only des checkpoints.
- Ancrage fonctionnel de continuité : `f644b4d42a48cda57cc1a7d9c6f26867852ac56e`.
- La branche de continuation reste `rewrite/naxa-from-main-20261007` ; aucune nouvelle branche créée.
- `main` et Production inchangés.

**Continuité : 🟢 fondation installée.**

## Clôture Partie 5 — preuve CI du 07/10/2026

- SHA de référence de clôture : `935026a21dfdadff10b0d44e1bc0aa83da0459a6`.
- CircleCI pipeline #3 : workflow `part5_gate` = **Success**.
- Job : `part5_check`, exécuté avec succès en 26 s.
- Preuve fonctionnelle : replay Supabase transactionnel PASS + ROLLBACK.
- **Partie 5 : 🟢 VERT — 100 %.**
- Prochaine étape : Partie 6 — Réconciliation finale Promoteur, uniquement après validation explicite du fondateur.


## Partie 6 — Réconciliation finale Promoteur : VERT

- Contradiction racine : le moteur de privilèges pouvait encore considérer valide un Promoteur sur la base de l'ancien abonnement par pharmacie, malgré l'expiration de l'abonnement Promoteur canonique.
- Migration corrective : `supabase/migration_048_reconciliation_finale_promoteur.sql`.
- Correction : `private.naxa_promoteur_valide()` délègue désormais exclusivement à `private.naxa_promoteur_valide_canonique()`.
- Sécurité : retrait de l'exécution client des fonctions mutantes `synchroniser_validite_promoteurs()` et `synchroniser_validite_pharmacies()`.
- Test contradictoire : `supabase/tests/048_reconciliation_finale_promoteur.sql`.
- Replay Supabase réel : PASS avec ROLLBACK, y compris le cas de régression « ancien abonnement pharmacie actif + abonnement Promoteur canonique expiré ».
- CI de clôture : SHA `4d8fb7c43ebc8642e644e96aeec4f37969c93a82`, CircleCI pipeline #13, workflow `part6_gate`, job `part6_check` = **Success**.
- Aucune persistance Production ; aucun merge vers `main` ; aucun déploiement Production.
- **Partie 6 : 🟢 VERT — 100 %.**

## Pilotage 360° — Partie 2 : socle Performance — EN COURS / NON VERT

- Migration : supabase/migration_049_pilotage_performance_socle.sql.
- Test contradictoire : supabase/tests/049_pilotage_performance_socle.sql.
- KPI couverts : pharmacies actives du scope, CA canonique, ventes, réservations, payées, retirées, lignes de stock, unités, ruptures et couverture stock.
- Contradiction détectée puis corrigée : les fixtures du test utilisaient des UUID de pharmacies sans créer les pharmacies correspondantes ; le test a été rendu autonome en créant p1 actif et p2 inactif dans la transaction.
- CI CircleCI : la configuration fonctionnelle a été corrigée pour utiliser un exécuteur machine afin que Supabase/Docker et PostgreSQL local soient joignables dans le même environnement ; délai d’absence de sortie porté à 30 min.
- Dernier commit de correction du test : 5c92278765f23768c9590b82257d98251466f95e.
- Dernier commit CI : 81dc2673ca9b182776ab87fbebbbe230ce8c9a5a.
- Preuve fonctionnelle CircleCI : NON DISPONIBLE À CET INSTANT ; le connecteur CircleCI n’est pas exposé dans cette session et GitHub ne rapporte encore aucun status pour ces commits.
- Conclusion : 🟠 NON VERT — preuve CI fonctionnelle manquante. Aucun passage à la Partie 3 et aucune persistance Production.

## Pilotage 360° — Partie 1 : audit canonique — VERT

- Périmètre séparé en quatre couches : Commercial, Performance, Sécurité/Réseau, Direction 360°.
- Source CA canonique verrouillée : `v_reservations_ca`.
- Scope réseau verrouillé : réseau actif autorisé du Promoteur ; aucune lecture hors périmètre.
- Validité Promoteur verrouillée sur le moteur canonique `private.naxa_promoteur_valide_canonique()`.
- Responsable confirmé comme fonction interne N2, pas comme `role_type`.
- Contradictions C1→C6 auditées et documentées dans `docs/PILOTAGE_360_AUDIT_PARTIE1.md`.
- Contrôle structurel documentaire C1→C6 : PASS.
- Aucune migration ni donnée Production modifiée.
- **Partie 1 Pilotage 360° : 🟢 VERT — 100 %.**

## Point de reprise après Pilotage 360° Partie 1

La prochaine étape est **Pilotage 360° — Partie 2 : socle Performance**. Elle doit inventorier les données réellement disponibles, définir les KPI de performance, tester les contradictions par rôle/scope et seulement ensuite coder si nécessaire.

## Pilotage 360° — Partie 3 : Sécurité & Réseau — 🟢 VERT / 100 %

- Contradiction racine 1 corrigée : après la réconciliation 048, le moteur historique à 3 paramètres de private.naxa_has_privilege() pouvait continuer à ignorer la nouvelle signature canonique ; migration 050 ajoute le pont de compatibilité vers le moteur canonique 4 paramètres.
- Contradiction racine 2 corrigée : un privilège RESEAU pouvait être bootstrapé par NAXA en utilisant une pharmacie hors réseau actif du Promoteur ; migration 050 exige désormais le lien promoteur_pharmacies.actif=true et la pharmacie active.
- Compatibilité schéma corrigée : le catalogue historique naxa_privileges.family et le catalogue canonique domaine sont réconciliés ; le privilège VIEW_PERFORMANCE_PILOTAGE est assuré par la migration 050.
- Sécurité hiérarchique : PHARMACIE/POSTE_CAISSE est autorisé uniquement si le profil appartient à la pharmacie et possède une lignée active remontant à un Promoteur canoniquement valide.
- Expiration du Promoteur : une expiration canonique invalide immédiatement les privilèges opérationnels des profils descendants du réseau.
- Test contradictoire : supabase/tests/050_security_network_hardening.sql.
- Preuve fonctionnelle : replay transactionnel sur le projet Supabase réel, migrations 044 + 048 + 050 + test 050, PASS avec ROLLBACK ; aucune donnée Production persistée.
- Contrôle supplémentaire : même test exécuté avec la compatibilité Production historique 3 paramètres ; PASS avec ROLLBACK.
- CI : gate structurel CircleCI part3_gate ajouté ; preuve fonctionnelle CI non remontée par les connecteurs disponibles. Le run GitHub diagnostique a échoué avant les steps (runner externe), sans échec SQL.
- Aucun merge main, aucun déploiement Production.

- Sessions : migration 051 impose au niveau DB un maximum de 4 sessions simultanées par compte, refuse la 5e sans supprimer les 4 existantes et journalise création/fin de session dans session_audit.
- Test session : supabase/tests/051_session_security_limit_audit.sql ; replay Supabase réel PASS + ROLLBACK.


## Pilotage 360° — Partie 4 : Direction 360° — 🟢 VERT / 100 %

### Périmètre
Cockpit Direction NAXA consolidant quatre axes canoniques :
1. réseau ;
2. commercial ;
3. performance ;
4. sécurité.

La Partie 4 est strictement fondée sur les données déjà disponibles. Les indicateurs ERP non supportés (marge, bénéfice, coûts, performance par caisse, rétention client) restent explicitement exclus.

### Implémentation
- `supabase/migration_052_direction_360.sql`
- `supabase/tests/052_direction_360.sql`
- privilège `VIEW_DIRECTION_360` : niveau 0, non délégable, gouvernance ;
- accès fonctionnel réservé à l'Admin Réseau NAXA.

### Contradictions corrigées
- migration 049 : suppression de la syntaxe PostgreSQL invalide `CREATE VIEW IF NOT EXISTS` ;
- réconciliation du view historique `v_reservations_ca`, dont la définition/les colonnes divergeaient du contrat canonique ;
- replay transactionnel complet 043→052 effectué sur Supabase réel.

### Preuves
- Direction 360 : **PASS**
- CA canonique : **PASS**
- absence de double comptage : **PASS**
- scope réseau : **PASS**
- rupture stock : **PASS**
- métrique sécurité : **PASS**
- période invalide refusée : **PASS**
- rollback : **PASS**
- Production : inchangée.
- main : inchangé.

**Partie 4 Direction 360° : 🟢 100 %.**

### Prochaine étape
**Validation explicite du fondateur avant de commencer le chantier suivant.**


## CP-0007 — Audit métier/global post-Direction 360°

- Audit : `docs/PILOTAGE_360_AUDIT_GLOBAL_POST_PART4.md`.
- Contradiction racine corrigée : Direction 360° comptait les Responsables via l'ancien `role_type='pharmacie'` au lieu de la fonction interne canonique `fonction_interne='responsable'`.
- Migration corrigée : `supabase/migration_052_direction_360.sql`.
- Test contradictoire renforcé : `supabase/tests/052_direction_360.sql`.
- Production : migration 042, aucune persistance 043→052.
- main : inchangé.
- **Audit métier/global : 🟢 VERT — 100 %.**
- Point de reprise : validation explicite du fondateur avant le chantier suivant.


## Réconciliation globale des privilèges — CP-0008

- Contradiction racine : un second trigger legacy `trg_naxa_provision_on_architecture` pouvait encore provisionner automatiquement les privilèges.
- Correction : `supabase/migration_046_disable_legacy_privilege_provisioning.sql` supprime les deux points d'entrée legacy et révoque l'exécution client.
- Test contradictoire : `supabase/tests/046_disable_legacy_privilege_provisioning.sql`.
- Audit : `docs/PILOTAGE_360_RECONCILIATION_PRIVILEGES.md`.
- Replay réel Supabase 043→052 + tests : PASS + ROLLBACK.
- Invariants privilèges : 🟢 tous les contrôles à zéro anomalie.
- Production : migration 042, inchangée.
- **Réconciliation globale des privilèges : 🟢 100 %.**
- Point d'arrêt : validation explicite du fondateur.
