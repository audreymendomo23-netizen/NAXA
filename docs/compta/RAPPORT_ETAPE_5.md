# Rapport d’étape 5 — Journal des ventes et rapprochements

Date : 21 octobre 2026  
Branche : `main`  
Référence : `docs/CAHIER_DES_CHARGES_COMPTE_COMPTABLE.md` §§ 4.2, 4.5, 4.6 et 6.  
Statut : **CODE INTÉGRÉ — VALIDATION SQL DU SCHÉMA SOURCE EFFECTUÉE — TYPECHECK/BUILD NON EXÉCUTÉS**.

## 1. Inspection des tables métier réelles

Le schéma a été interrogé sur la base Supabase isolée `naxa-ci-replay-2` avant d’écrire les écrans. Les tables et colonnes confirmées incluent :

- `ventes` : `pharmacie_id`, `numero_vente`, `statut`, `remise`, `total_brut`, `total_net`, `mode_paiement`, `paiement_ref`, `created_at`, `paid_at`, `caisse_session_id`.
- `vente_paiements` : paiements détaillés, mode, montant, référence et horodatage. Le nouvel écran n’expose pas ces lignes tant que leur relation métier et le traitement des paiements multiples ne sont pas intégrés.
- `tresorerie_mouvements` : `pharmacie_id`, `nature`, `montant`, `libelle`, `reference`, `source_type`, `source_id`, `date_operation`, `compte_id`.
- `depenses` existe également, mais la présente tranche n’ajoute aucune écriture ni action de validation de dépense.

Aucune colonne de TVA enregistrée n’a été confirmée dans la table `ventes`. Le journal ne calcule donc pas de TVA fictive. Le schéma des clôtures/sessions de caisse n’a pas été suffisamment confirmé pour en faire une source de rapprochement dans cette tranche.

## 2. Journal des ventes

Fichier : `src/app/pharmacie/comptable/journal-ventes/page.tsx`.

- Session serveur obligatoire, profil actif et pharmacie rattachée.
- Vérification du privilège existant `MANAGE_ACCOUNTING` ; aucun nouveau rôle ni privilège n’est ajouté.
- Requêtes en lecture seule sur `ventes`, bornées par `pharmacie_id`, limite de 200 lignes et filtres de dates/statut.
- Affichage de la date de vente, référence, identifiant abrégé de session de caisse, statut, brut, remise, net et mode de paiement.
- Aucune identité client, ordonnance ou donnée clinique chargée.
- Indicateurs clairement étiquetés comme sous-ensemble chargé ; aucune prétention à un total exhaustif.
- Aucun bouton d’encaissement, d’annulation, de clôture ou de modification de vente.

## 3. Trésorerie et rapprochements

Fichier : `src/app/pharmacie/comptable/rapprochements/page.tsx`.

- Lecture bornée par pharmacie des `tresorerie_mouvements` et ventes payées.
- Filtres de dates, limite de 200 lignes par source, gestion des erreurs et avertissement lorsque l’échantillon est tronqué.
- Une correspondance est reconnue uniquement lorsque `source_type = vente` et `source_id = ventes.id`. Aucun rapprochement approximatif par montant n’est présenté comme certain.
- Les ventes payées sans mouvement lié dans l’échantillon sont présentées comme **à examiner**, pas comme des encaissements manquants confirmés.
- Aucune écriture, validation, modification ou suppression de mouvement n’est effectuée.
- Les clôtures de caisse, relevés bancaires et rapprochements par mode de paiement restent à intégrer après vérification de leurs sources et statuts exacts.

## 4. Navigation

Le tableau de bord `src/app/pharmacie/comptable/page.tsx` relie désormais le journal des ventes et les rapprochements. La prochaine entrée, créances et bordereaux, est annoncée comme prochaine tranche et n’est pas présentée comme déjà fonctionnelle.

## 5. Séparation des tâches et absence de régression volontaire

Les deux écrans sont exclusivement en lecture seule. Ils ne touchent ni aux RPC de caisse, ni aux transitions de vente, ni aux tables de stock, ni aux opérations du Pharmacien ou du Gestionnaire de stock. Aucun privilège serveur n’a été élargi et aucune migration SQL n’a été appliquée à la base active.

La sécurité réelle dépend aussi des politiques RLS et des droits déjà présents sur l’environnement cible ; leur validation exhaustive avec les identités de chaque rôle n’a pas été réalisée ici. L’existence du contrôle `naxa_can` ne remplace pas les politiques RLS.

## 6. Contrôles réellement effectués

| Contrôle | Résultat |
|---|---|
| Inspection des colonnes de tables sources sur base de test | PASS — colonnes métier consultées |
| Confirmation des valeurs de statut de vente | PASS — `brouillon`, `payee`, `annulee` |
| Écrans journal/rapprochements ajoutés sur `main` | PASS — fichiers enregistrés |
| Liens ajoutés au tableau de bord | PASS — liens vers les deux routes |
| Tests de parcours UI en navigateur | NON EXÉCUTÉS |
| Typecheck TypeScript | NON EXÉCUTÉ |
| Build frontend | NON EXÉCUTÉ |
| CI | NON CONSULTÉE / NON LANCÉE |
| Migration base active | NON APPLIQUÉE |
| Déploiement | NON EFFECTUÉ |

## 7. Suite — étape 5 en cours de progression

Cette étape construit les deux premières listes financières à partir des tables métier existantes. Pour terminer le périmètre demandé, les tranches suivantes devront ajouter les créances/bordereaux et rejets/relances, puis rapports/exports, documents et audit, profil/déconnexion, après inspection des tables et privilèges propres à chaque fonction. Aucun format d’export d’assureur, taux de TVA ou règle fiscale n’est inventé.

## Fichiers

- [Journal des ventes](../../src/app/pharmacie/comptable/journal-ventes/page.tsx)
- [Rapprochements](../../src/app/pharmacie/comptable/rapprochements/page.tsx)
- [Tableau de bord](../../src/app/pharmacie/comptable/page.tsx)
- [Cahier des charges](../CAHIER_DES_CHARGES_COMPTE_COMPTABLE.md)
