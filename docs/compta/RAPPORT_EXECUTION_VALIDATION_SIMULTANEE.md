# Rapport d'exécution — validation simultanée Comptable hors CI

Date : 21 octobre 2026  
Branche du code consultée : `main`  
Base SQL de test : `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`)  
Base active : non modifiée.

## Résultats exécutés pendant cette session

Les scripts ont été récupérés depuis `main` et envoyés directement à la base de test isolée. Aucun pipeline ni contrôle CI n'a été consulté ou lancé.

| Test | Résultat observé | Portée |
|---|---|---|
| `160_compta_socle.sql` | **PASS** — marqueur explicite | Socle, équilibre, périodes, idempotence et droits couverts par ce script transactionnel. |
| `161_compta_outbox.sql` | **PASS** — marqueur explicite ajouté puis vérifié | Assertions structurelles de l’outbox; le script affiche maintenant un résultat explicite après rollback. |
| `162_compta_worker.sql` | **PASS** — marqueur explicite ajouté puis vérifié | Sécurité du worker, refus de finalisation prématurée et chemin sans mapping; résultat explicite après rollback. |
| `163_compta_worker_positive.sql` | **PASS** — marqueur explicite | Chemin positif transactionnel du worker, fixtures annulées par rollback. |
| `164_compta_reports_rls.sql` | **PASS** — marqueur explicite | RLS des rapports planifiés. |
| `165_compta_readonly_reference_rls.sql` | **PASS** — marqueur explicite | Référentiels en lecture seule. |
| `166_compta_recus_abonnement_rpc.sql` | **PASS** — marqueur explicite | RPC de consultation des reçus d’abonnement. |
| `167_compta_cloture_etape8_structure.sql` | **PASS** — marqueur explicite | Structure des contrôles de clôture. |
| `168_compta_audit_chain_integrity.sql` | **PASS** — marqueur explicite | Intégrité de la chaîne d'audit et détection de modification simulée. |
| `169_compta_controles_cloture_rpc.sql` | **PASS** — marqueur explicite | Garde-fous de la RPC des contrôles de clôture. |
| `170_compta_recette_etape9_security.sql` | **PASS** — marqueur explicite | Contrôles structurels de sécurité comptable. |
| `171_compta_recette_etape10_hardening.sql` | **PASS** — marqueur explicite | Immutabilité, partie double différée, RLS et séparation des droits. |

Les tests SQL s'exécutent avec des transactions et rollback dans les scripts concernés. Au total, **les 12 tests comptables 160–171 ont maintenant retourné un marqueur PASS explicite** sur la base isolée. Les scripts 161 et 162 ont été ajustés pour émettre un résultat explicite après rollback, puis réexécutés avec succès.

## État de la base de test

Requête SQL en lecture seule :

| Objet | Lignes |
|---|---:|
| Pharmacies | 6 |
| Profils | 0 |
| Ventes | 0 |
| Dépenses | 0 |
| Mouvements de trésorerie | 0 |
| Périodes comptables | 0 |
| Écritures comptables | 0 |
| Lignes comptables | 0 |
| Comptes du plan comptable | 0 |

Cela bloque la recette authentifiée E2E avec les données actuellement disponibles. Aucun faux dossier métier persistant n'a été créé.

## Vérifications non exécutées

- `npm run test:compta-moteur` : **NON EXÉCUTÉ** (pas de checkout local du dépôt accessible à ce runtime). Le script a été complété pour couvrir les dates calendaires impossibles, mais son exécution réelle reste à faire.
- Typecheck, lint et build : **NON EXÉCUTÉS**.
- Tests frontend/navigateur et téléchargement effectif CSV/XLSX/PDF : **NON EXÉCUTÉS**.
- Recette E2E authentifiée inter-pharmacies : **BLOQUÉE**, car aucun profil et aucune donnée métier de test n'existent dans cette base.
- Rejeu canonique intégral des migrations : **NON VALIDÉ** ; l'historique de cette base de test n'est pas canonique et ne doit pas être réparé par réapplication aveugle.
- Base Supabase active : **NON MODIFIÉE**.
- CI et déploiement : **NON CONSULTÉS / NON LANCÉS**.

## Alertes de conseillers observées sur la base isolée

- Une vue `public.v_reservations_ca` en SECURITY DEFINER (niveau ERROR).
- 13 tables avec RLS activée mais sans politiques (niveau INFO; l'absence de politique peut être volontaire pour des tables internes, à confirmer individuellement).
- Deux extensions dans `public` : `pg_trgm` et `unaccent` (WARN).
- 15 fonctions SECURITY DEFINER exécutables par `anon` (WARN; chaque fonction doit être examinée selon l'intention d'accès).
- Le conseiller performance signale un volume important de clés étrangères sans index couvrant; les index équivalents et la charge doivent être vérifiés avant toute modification.

Liens de remédiation :
- [Vue SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view)
- [RLS activée sans politique](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Extensions dans public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)
- [Fonctions SECURITY DEFINER exécutables par anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)

Ces alertes ont été consultées sur le projet isolé uniquement. Aucune modification de sécurité globale n'a été appliquée : il faut analyser les consommateurs et les effets RLS avant de toucher une vue ou une fonction partagée.

## Correction de code réalisée pendant la poursuite

- Commit `03b583e03d96ec5c800283438a6c36857c23cce5` : le moteur `src/lib/compta/moteur.ts` valide désormais les dates calendaires ISO strictement (une date comme `2026-02-31` est refusée au lieu d'être normalisée par `Date.parse`). Les fenêtres de validité des mappings avec date invalide ou intervalle inversé sont ignorées, ce qui laisse l'événement `à traiter` plutôt que de comptabiliser à partir d'un mapping mal formé.
- Commit `9d913120a14178bf5cd8b55f16b58151b0ec2818` : tests de régression ajoutés pour date d'événement impossible, date de mapping impossible et intervalle de validité inversé.
- Commit `5f0282cfe89d53c1f038470a288e87069956d0aa` : le test SQL 162 expose désormais un marqueur PASS après rollback. Le test 161 a également été corrigé pour exposer `161_compta_outbox PASS` (commit créé juste avant celui du test 162).
- Un contrôle de cohérence de l'algorithme de date a été exécuté dans le runtime JavaScript sur six cas (date normale, 31 février, 29 février non bissextile, 29 février bissextile, mois invalide, format invalide) : **6/6 attendus**. Ce contrôle ciblé ne remplace pas l'exécution du script npm complet.

### Vérification supplémentaire des rapports mensuels planifiés

La fonction `public.compta_generer_rapport_mensuel()` existe sur la base isolée, et le job `naxa-compta-rapport-mensuel` est présent dans `pg_cron`. Un test transactionnel a appelé la fonction, comparé le nombre de rapports créés au nombre retourné, puis effectué un `ROLLBACK` : **PASS** (`PASS compta_generer_rapport_mensuel transactionnel`). Une requête post-test confirme qu'aucun rapport comptable de test n'est resté persistant. Ce test valide l'exécution transactionnelle de la fonction sur la base isolée, pas la livraison réelle d'un rapport à un utilisateur.

## État de l'historique des migrations de test

Le dépôt contient neuf migrations Comptable identifiées, tandis que l'historique de la base isolée expose huit entrées Comptable et comporte des doublons de noms de migration ailleurs dans l'historique. La migration `migration_20261023_compta_rapports_planifies.sql` n'apparaît pas sous ce nom dans l'historique observé. Aucun rejeu ni réparation automatique n'a été tenté : cette base ne constitue pas un historique canonique et la migration des rapports planifiés contient un éventuel enregistrement `pg_cron` à inspecter avant application.

## Conclusion opérationnelle

Le socle SQL comptable dispose de plusieurs preuves structurelles positives, mais la validation simultanée du parcours entier n'est pas terminée. Les prochains blocages à lever sont :

1. rendre l'historique de migrations de l'environnement de test cohérent sans réexécution aveugle;
2. obtenir un environnement de test canonique et des identités autorisées pour la recette;
3. exécuter les tests du moteur TypeScript et les contrôles locaux hors CI;
4. réaliser les parcours UI/API et les scénarios positifs/négatifs du cahier;
5. corriger uniquement les alertes de sécurité confirmées après analyse d'impact.

Aucun déploiement n'est autorisé par ce rapport. Dernier commit documentaire observé après cette mise à jour : voir la tête actuelle de `main`.
