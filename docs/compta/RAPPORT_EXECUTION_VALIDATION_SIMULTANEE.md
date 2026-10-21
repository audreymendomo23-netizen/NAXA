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
| `161_compta_outbox.sql` | **EXÉCUTÉ — aucun marqueur PASS émis** | Assertions structurelles exécutées sans erreur SQL retournée; ne pas compter comme PASS explicite. |
| `162_compta_worker.sql` | **EXÉCUTÉ — aucun marqueur PASS final émis** | Assertions de worker/reprise exécutées sans erreur SQL retournée; ne pas compter comme PASS explicite. |
| `163_compta_worker_positive.sql` | **PASS** — marqueur explicite | Chemin positif transactionnel du worker, fixtures annulées par rollback. |
| `167_compta_cloture_etape8_structure.sql` | **PASS** — marqueur explicite | Structure des contrôles de clôture. |
| `168_compta_audit_chain_integrity.sql` | **PASS** — marqueur explicite | Intégrité de la chaîne d'audit et détection de modification simulée. |
| `169_compta_controles_cloture_rpc.sql` | **PASS** — marqueur explicite | Garde-fous de la RPC des contrôles de clôture. |
| `170_compta_recette_etape9_security.sql` | **PASS** — marqueur explicite | Contrôles structurels de sécurité comptable. |
| `171_compta_recette_etape10_hardening.sql` | **PASS** — marqueur explicite | Immutabilité, partie double différée, RLS et séparation des droits. |

Les tests SQL s'exécutent avec des transactions et rollback dans les scripts concernés. Les tests 160 et 163 ont retourné explicitement leur marqueur PASS. Les tests 167 à 171 ont également retourné explicitement PASS pendant cette session.

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

- `npm run test:compta-moteur` : **NON EXÉCUTÉ** (pas de checkout local du dépôt accessible à ce runtime).
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

## Conclusion opérationnelle

Le socle SQL comptable dispose de plusieurs preuves structurelles positives, mais la validation simultanée du parcours entier n'est pas terminée. Les prochains blocages à lever sont :

1. rendre l'historique de migrations de l'environnement de test cohérent sans réexécution aveugle;
2. obtenir un environnement de test canonique et des identités autorisées pour la recette;
3. exécuter les tests du moteur TypeScript et les contrôles locaux hors CI;
4. réaliser les parcours UI/API et les scénarios positifs/négatifs du cahier;
5. corriger uniquement les alertes de sécurité confirmées après analyse d'impact.

Aucun déploiement n'est autorisé par ce rapport.
