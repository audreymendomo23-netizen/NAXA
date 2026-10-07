# NAXA — STATUT

Mise à jour : 7 octobre 2026 — reprise contrôlée / reconstruction canonique

## État actuel
**REWRITE ISOLÉ DE MAIN — PARTIE 1 VERT. PRODUCTION INCHANGÉE.**

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

## Prochaine étape — validation requise
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

## Prochaine étape — validation requise
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

## Prochaine étape — validation requise

**Partie 5** uniquement après validation explicite du fondateur.


## Partie 5 — Scope réseau + Pilotage Promoteur

- Audit : le contrat `RESEAU` de `naxa_profile_privileges` exigeait `pharmacie_id IS NULL`.
- Rouge détecté : `naxa_grant_privilege()` injectait pourtant `p_pharmacie` pour un scope `RESEAU`.
- Correction : `migration_047_network_scope_pilotage_promoteur.sql` normalise le scope réseau à `pharmacie_id = NULL` et corrige aussi la révocation réseau.
- Contrôle de portée : seul le réseau actif du Promoteur alimente `stats_pilotage_scope()`.
- Test contradictoire réel : bootstrap NAXA → privilège réseau effectif → pilotage limité au réseau actif → auto-attribution Promoteur refusée → révocation réseau NAXA contrôlée.
- Test exécuté transactionnellement avec ROLLBACK.
- `main` et Production inchangés.
- **Partie 5 : 🟡 non clôturée — CI GitHub bloquée avant l'exécution des steps.**

CI gate: runner standard `ubuntu-latest` configuré pour la validation structurelle.


### Blocage CI Partie 5 — 07/10/2026
- Replay Supabase réel : PASS transactionnel, avec ROLLBACK et aucune donnée persistée.
- Correction racine : le scope `RESEAU` exigeait `pharmacie_id=NULL`, alors que `naxa_grant_privilege()` injectait `p_pharmacie`. Migration 047 corrige l'attribution et la révocation réseau.
- Contrôles fonctionnels : bootstrap NAXA → accès Promoteur au réseau actif → exclusion du réseau inactif/hors périmètre → auto-attribution réseau refusée → révocation refusée au Promoteur et autorisée à NAXA → réactivation testée.
- CI GitHub : le gate a été relancé sur `ubuntu-latest` (run `37653058140`) ; il échoue toujours avant toute étape (`steps=null`, durée facturable 0 ms). Le workflow qualité parallèle échoue également avant steps sur ses jobs `ubuntu-24.04`, ce qui isole le problème au niveau de l'allocation/exécution des runners GitHub plutôt qu'au test Partie 5. Aucun motif de facturation précis n'est affirmé sans message runner accessible.
- **Aucune validation finale de la Partie 5 tant que cette preuve CI réelle n'est pas obtenue.**


## Système de continuité déterministe — installé

- `docs/NAXA_MASTER_INDEX.md` : hiérarchie des autorités et état de référence.
- `docs/CONTINUITE_NAXA.md` : protocole obligatoire de reprise.
- `docs/NAXA_REPRISE_EXACTE.md` : checkpoint courant unique avec position exacte.
- `docs/NAXA_CHECKPOINTS.md` : historique append-only des checkpoints.
- Ancrage fonctionnel de continuité : `f644b4d42a48cda57cc1a7d9c6f26867852ac56e`.
- La branche de continuation reste `rewrite/naxa-from-main-20261007` ; aucune nouvelle branche créée.
- `main` et Production inchangés.

**Continuité : 🟢 fondation installée.**

## Reprise Partie 5 — état après audit CI du 07/10/2026
- SHA courant : `940aea76e2553378d56be49b451e2c41d1b11771`.
- Correction appliquée au gate : `runs-on: ubuntu-latest` + `timeout-minutes: 10`.
- Run réel : `37653058140`, job `112901096630`.
- Résultat : échec avant steps, `steps=null`, 0 ms facturables.
- Même symptôme sur `naxa-quality` (`37653057958`) : plusieurs jobs `ubuntu-24.04` échouent avant steps.
- **Partie 5 reste 🟡. Aucun passage au vert tant qu'un runner n'exécute réellement le gate.**
