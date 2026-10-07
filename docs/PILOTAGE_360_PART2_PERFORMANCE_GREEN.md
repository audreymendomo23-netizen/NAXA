# NAXA — Pilotage 360° — Partie 2 : Socle Performance

Date : 07/10/2026
Branche : `rewrite/naxa-from-main-20261007`

## Objet

Clôturer définitivement le socle Performance après reprise du bloc resté non vert.

## Audit et contradictions

### C1 — Fixture pharmacie non isolée
Le test utilisait des UUID fixes (`000...001`, `000...002`) déjà présents en Production.

**Cause racine :** le test contradictoire n'était pas déterministe vis-à-vis des données existantes.

**Correction :** `p1` et `p2` sont désormais générés avec `gen_random_uuid()`.

### C2 — Fixture couplée au trigger Auth
Le test créait des utilisateurs Auth pour obtenir les profils, ce qui déclenchait une validation téléphone sans rapport avec le périmètre Performance.

**Cause racine :** dépendance du test à un mécanisme Auth externe au contrat testé.

**Correction :** les fixtures Auth sont créées avec `session_replication_role=replica` uniquement pendant l'insertion transactionnelle, puis le rôle est restauré. Les profils de test sont créés explicitement avec le contrat canonique.

Cette isolation ne modifie aucune configuration Production.

### C3 — Gate structurel CI incohérent
Le gate cherchait la syntaxe invalide `create view if not exists`, alors que la migration corrigée utilise la réconciliation PostgreSQL `drop view if exists` puis `create view`.

**Correction :** assertion CI alignée sur la migration réellement validée.

### C4 — Exécuteur CI fonctionnel inadapté
Le job Partie 2 utilisait Docker/remote-Docker alors que le replay Supabase doit disposer du moteur Docker et du client PostgreSQL dans le même environnement.

**Correction :** job déplacé sur exécuteur machine, avec délai de 30 minutes, installation explicite du client PostgreSQL et exécution du test par `psql`.

Le workflow GitHub a également été aligné sur `psql`.

## Implémentation canonique

Migration :
`supabase/migration_049_pilotage_performance_socle.sql`

Elle fournit :
- CA canonique via `v_reservations_ca` ;
- ventes sans double comptage ;
- réservations/payées/retirées ;
- lignes et unités de stock ;
- ruptures ;
- couverture stock ;
- panier moyen ;
- scope Admin / Promoteur / Responsable / Caisse ;
- exclusion explicite des KPI ERP non disponibles.

La vue utilise `security_invoker=true`, conformément au modèle de sécurité des vues PostgreSQL/Supabase.

## Preuve fonctionnelle réelle

Replay transactionnel réel Supabase :
- migrations 043 → 049 ;
- test contradictoire Partie 2 ;
- résultat : **PASS** ;
- transaction finale : **ROLLBACK**.

Contrôles obtenus :
- scope Promoteur limité au réseau actif ;
- pharmacie inactive exclue ;
- CA = 12 000 XAF ;
- ventes = 1 ;
- absence de double comptage ;
- rupture = 1 ;
- couverture = 0 % ;
- expiration de l'abonnement Promoteur : accès au pilotage refusé.

Après rollback :
- fixtures `PART2` persistées : 0 pharmacie ;
- produit `PART2 TEST` persistant : 0 ;
- historique Supabase Production inchangé à la migration 042.

## Contrôle structurel CI

Les assertions du gate Partie 2 ont été vérifiées sur la branche :
- vue réconciliée ;
- `stats_pilotage_scope` présente ;
- `security_invoker` présent ;
- assertions contradictoires présentes ;
- exécuteur machine configuré ;
- replay fonctionnel exécuté via PostgreSQL client.

Le connecteur GitHub de cette session ne remonte pas de run CircleCI pour ce commit ; aucune réussite CI distante n'est inventée. La preuve de comportement repose sur le replay Supabase réel transactionnel, et le gate structurel est vérifié directement sur les fichiers de la branche.

## Observation hors périmètre

L'audit a également révélé que la fonction Auth historique de Production contient une validation téléphonique dont l'expression régulière est incohérente avec le format `+237...`. Cette anomalie est réelle mais indépendante du contrat Performance ; aucune modification Auth/Production n'a été introduite pour verdir la Partie 2. Elle devra être traitée comme chantier sécurité/Auth dédié.

## Verdict

**PARTIE 2 — SOCLE PERFORMANCE : 🟢 VERT — 100 %.**

Aucun merge vers `main`.
Aucune migration persistée en Production.
Aucun déploiement Production.
Aucun service payant.
