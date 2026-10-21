# Rapport d’étape 4 — Worker et premier poste Comptable

Date : 21 octobre 2026  
Branche : `main`  
Référence fonctionnelle : `docs/CAHIER_DES_CHARGES_COMPTE_COMPTABLE.md`  
Statut : **CODE ENREGISTRÉ — EXÉCUTION LOCALE, MIGRATION ET TESTS NON VALIDÉS**.

> Le cahier des charges décrit les fonctionnalités du poste mais ne numérote pas lui-même les phases d’implémentation. Cette étape 4 est donc la suite technique du chantier : terminer le chemin worker minimal puis commencer l’écran de pilotage sans données fictives.

## 1. Worker comptable

Fichiers ajoutés/modifiés :

- `supabase/migration_20261022_compta_worker.sql`
- `supabase/functions/compta-worker/index.ts`
- `supabase/tests/162_compta_worker.sql`
- `supabase/migration_20261021_compta_outbox.sql` — correction du fuseau métier de vente.
- `docs/compta/RAPPORT_ETAPE_4.md`

### Traitement
1. Le worker Edge Function réclame jusqu’à 50 événements via RPC, puis les traite séquentiellement.
2. Le traitement vérifie le jeton de réclamation et le rôle serveur.
3. Il valide le montant FCFA entier, la date comptable, l’existence d’une seule période ouverte et d’un seul journal validé applicable.
4. Il exige un mapping débit et un mapping crédit uniques, valides à la date, avec comptes validés dans la même pharmacie.
5. Il crée une écriture par partie double via `compta_poster_ecriture`, protégée par clé d’idempotence.
6. L’événement n’est finalisé qu’après présence de l’écriture correspondante.
7. Les erreurs ne stockent qu’un code SQL technique; reprise après 15 minutes, arrêt après 8 tentatives. Aucun taux ou compte par défaut.

La date comptable des ventes est désormais dérivée de l’horodatage de paiement dans le fuseau `Africa/Douala`. Les dépenses utilisent leur date métier `date_depense`.

### Activation non effectuée
Le worker n’est pas encore planifié automatiquement : il faut configurer les secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `COMPTA_WORKER_SECRET` et le déclenchement planifié (cible toutes les 15 minutes) dans un environnement de test. Le secret de worker ne doit jamais être livré au navigateur. Aucune migration n’a été appliquée à la base active.

## 2. Étape 4 du parcours Comptable — première interface

Ajout de `src/app/pharmacie/comptable/page.tsx` :

- route protégée par session serveur, compte actif, pharmacie liée et privilège `MANAGE_ACCOUNTING`;
- lecture bornée à la pharmacie du profil, sans accès multi-pharmacie implicite;
- tableau de bord avec derniers événements de la file, dernières écritures, périodes ouvertes et erreurs;
- états vides et erreurs explicites; aucun chiffre de démonstration;
- affichage des références financières uniquement, sans identité patient ni détail médical;
- aucune action d’encaissement, de validation finale ou de modification de source.

La page reste une première tranche de l’interface. Les autres entrées du cahier (journal des ventes, créances/bordereaux, rejets/relances, trésorerie, rapports/exports, documents, audit, profil et déconnexion dédiée) ne sont pas déclarées terminées.

## 3. Fichiers

- [Migration worker](../../supabase/migration_20261022_compta_worker.sql)
- [Edge Function](../../supabase/functions/compta-worker/index.ts)
- [Test SQL worker](../../supabase/tests/162_compta_worker.sql)
- [Dashboard Comptable](../../src/app/pharmacie/comptable/page.tsx)
- [Migration outbox](../../supabase/migration_20261021_compta_outbox.sql)

## 4. Vérifications — état réel

| Vérification | État |
|---|---|
| Changements enregistrés sur `main` | PASS — fichiers relus via l’API GitHub |
| Tests TypeScript locaux | NON EXÉCUTÉS — pas de clone local / résolution GitHub indisponible |
| Typecheck du dépôt | NON EXÉCUTÉ — aucun `tsconfig.json` local |
| Tests SQL 160, 161, 162 après nouvelles migrations | NON EXÉCUTÉS |
| Exécution réelle du worker | NON EXÉCUTÉE |
| Build frontend | NON EXÉCUTÉ |
| CI | NON CONSULTÉE / NON LANCÉE |
| Migration Supabase active | NON APPLIQUÉE |
| Déploiement | NON EFFECTUÉ |

Les tests structurels ajoutés ne prouvent pas l’exécution métier bout en bout. La suite doit être exécutée dans un clone local fonctionnel ou une base de test isolée avant de considérer ce parcours validé.
