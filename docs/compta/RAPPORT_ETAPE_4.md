# Rapport d’étape 4 — Worker et premier poste Comptable

Date de mise à jour : 21 octobre 2026  
Branche : `main`  
Référence fonctionnelle : `docs/CAHIER_DES_CHARGES_COMPTE_COMPTABLE.md`  
Statut : **ÉTAPE TECHNIQUE 4 TERMINÉE POUR SON PÉRIMÈTRE — VALIDATION SQL EN BASE DE TEST**.

> Le cahier des charges décrit les fonctionnalités du poste mais ne numérote pas lui-même les phases d’implémentation. Cette étape 4 est la suite technique définie pour le chantier : construire le chemin worker minimal, le valider sur une base isolée et commencer l’écran de pilotage sans données fictives. Elle ne signifie pas que les dix entrées du parcours Comptable complet sont déjà toutes livrées.

## 1. Worker comptable

Fichiers :
- `supabase/migration_20261022_compta_worker.sql`
- `supabase/functions/compta-worker/index.ts`
- `supabase/tests/162_compta_worker.sql`
- `supabase/tests/163_compta_worker_positive.sql`
- `supabase/migration_20261021_compta_outbox.sql`
- `supabase/tests/161_compta_outbox.sql`

Traitement :
1. L’Edge Function réclame jusqu’à 50 événements via RPC, puis les traite séquentiellement.
2. Le traitement vérifie le jeton de réclamation et le rôle serveur.
3. Il valide le montant FCFA entier, la date comptable, l’existence d’une seule période ouverte et d’un seul journal validé applicable.
4. Il exige un mapping débit et un mapping crédit uniques, valides à la date, avec des comptes validés dans la même pharmacie.
5. Il crée une écriture en partie double via `compta_poster_ecriture`, protégée par une clé d’idempotence.
6. L’événement n’est finalisé qu’après présence de l’écriture correspondante.
7. Les erreurs stockent uniquement un code SQL technique; reprise après 15 minutes, arrêt après 8 tentatives. Aucun compte, taux ou journal par défaut.

La date comptable des ventes est dérivée de l’horodatage de paiement dans le fuseau `Africa/Douala`. Les dépenses utilisent leur date métier `date_depense`.

## 2. Validation effectivement exécutée

Environnement isolé : projet Supabase de test `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`). Les migrations ont été appliquées uniquement sur cette base de test, dans l’ordre outbox puis worker. Aucune migration comptable n’a été appliquée à la base active NAXA.

| Contrôle | Résultat |
|---|---|
| Application migration outbox | PASS |
| Application migration worker | PASS |
| `supabase/tests/160_compta_socle.sql` | PASS — retour explicite `160_compta_socle PASS` |
| `supabase/tests/161_compta_outbox.sql` | PASS — aucune exception SQL |
| `supabase/tests/162_compta_worker.sql` | PASS — aucune exception SQL |
| Parcours worker transactionnel négatif (`162`) | PASS — réclamation, jeton, finalisation prématurée refusée, absence de configuration gérée en reprise |
| Parcours worker positif (`163`) | PASS — période ouverte, mappings débit/crédit et journal explicitement validés, réclamation, écriture de deux lignes équilibrées à 12 500 FCFA, événement finalisé |
| Vérification après rollback | PASS — aucun événement de test conservé |
| Exécution locale TypeScript / typecheck | NON EXÉCUTÉE |
| Build frontend | NON EXÉCUTÉ |
| CI | NON CONSULTÉE / NON LANCÉE |
| Migration base active | NON APPLIQUÉE |
| Déploiement Edge Function / activation cron | NON EFFECTUÉS |

Les tests `162` et `163` couvrent maintenant les deux chemins du worker. Le chemin négatif prouve la reprise sûre en l’absence de configuration. Le chemin positif utilise des références techniques temporaires, explicitement validées dans la transaction de test, et prouve la création de deux lignes totalisant 12 500 FCFA au débit comme au crédit puis la finalisation de l’événement. Toutes les fixtures sont annulées par `ROLLBACK`. Cela valide le mécanisme, mais ne valide pas les mappings SYSCOHADA propres à une pharmacie réelle.

## 3. Premier écran Comptable

Fichier : `src/app/pharmacie/comptable/page.tsx`.

- route protégée par session serveur, compte actif, pharmacie liée et privilège `MANAGE_ACCOUNTING`;
- lecture bornée à la pharmacie du profil;
- affichage des écritures récentes, événements de file, erreurs et périodes ouvertes;
- états vides et erreurs explicites; aucun chiffre de démonstration;
- références financières uniquement, sans identité patient ni détail médical;
- aucune action d’encaissement, de validation finale ou de modification de source.

Le code frontend a été relu mais pas compilé dans cette session, faute de clone local accessible. Le tableau de bord est la première tranche d’interface, pas l’ensemble du poste Comptable.

## 4. Activation opérationnelle — non effectuée

L’Edge Function n’est pas déployée et aucun déclencheur périodique n’est activé. Avant activation, configurer dans l’environnement cible les secrets serveur `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` et `COMPTA_WORKER_SECRET`, puis mettre en place un déclenchement planifié côté serveur. Le secret personnalisé doit être long, aléatoire et absent du navigateur, des journaux et du dépôt. La clé service-role ne doit jamais être exposée côté client.

Ne pas activer le worker sur une pharmacie réelle tant que son plan comptable, ses mappings par événement, ses périodes et ses codes de journaux n’ont pas été validés par le responsable compétent.

## 5. Limites et suite du parcours complet

Les autres entrées du cahier des charges — journal des ventes, créances/bordereaux, rejets/relances, trésorerie/rapprochements, rapports/exports, documents, journal d’audit, profil et déconnexion dédiée — restent des chantiers séparés. Elles ne sont pas déclarées terminées dans ce rapport.

Aucune valeur fiscale, règle de TVA ou mapping SYSCOHADA n’a été inventé. Les exports futurs devront porter la mention : « État préparé par NAXA, à contrôler par votre expert-comptable ».

## 6. Fichiers de référence

- [Migration outbox](../../supabase/migration_20261021_compta_outbox.sql)
- [Migration worker](../../supabase/migration_20261022_compta_worker.sql)
- [Edge Function](../../supabase/functions/compta-worker/index.ts)
- [Test SQL outbox](../../supabase/tests/161_compta_outbox.sql)
- [Test SQL worker — sécurité et reprise](../../supabase/tests/162_compta_worker.sql)
- [Test SQL worker — chemin positif](../../supabase/tests/163_compta_worker_positive.sql)
- [Dashboard Comptable](../../src/app/pharmacie/comptable/page.tsx)
