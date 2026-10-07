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
