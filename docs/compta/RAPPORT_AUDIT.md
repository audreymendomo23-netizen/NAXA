# Rapport d'audit préalable — Compte Comptable NAXA

Date : 2026-10-21  
Branche examinée : `main`  
Statut : **BLOQUÉ — audit préliminaire uniquement**  
Aucun module ERP ni aucune migration n'ont été modifiés. Aucun contrôle CI n'a été lancé ou consulté.

## 1. Blocage documentaire à lever

Les trois sources désignées comme autorité dans la demande n'ont pas été trouvées sur `main`, aux chemins testés :

- `01_CAHIER_DES_CHARGES_COMPTABLE_NAXA.md`
- `02_DESIGN_COMPTABLE_NAXA.md`
- `03_CODE_BASE_COMPTABLE_NAXA.md`

Les chemins exacts testés à la racine et dans `docs/compta/` renvoient 404 pour les trois fichiers. Le dossier `docs/compta/` existe bien sur `main` et contient ce rapport ; la formulation précédente indiquant que ce dossier n'existait pas était erronée. L'inventaire récursif du dépôt confirme également la présence de `docs/CAHIER_DES_CHARGES_COMPTE_COMPTABLE.md`, distinct des trois sources demandées.

Un autre document est présent : `docs/CAHIER_DES_CHARGES_COMPTE_COMPTABLE.md`. Il ne peut pas être traité automatiquement comme équivalent aux trois sources prioritaires que tu viens de spécifier, notamment pour reprendre « tels quels » le moteur et les tests déjà validés.

**Question bloquante (1/10)** : où se trouvent les trois fichiers de référence — faut-il les ajouter au dépôt, ou sont-ils disponibles dans un autre chemin/dépôt ? Merci de fournir leurs chemins exacts ou de les joindre. Conformément à la consigne, le chantier s'arrête ici jusqu'à résolution de ce point.

## 2. Éléments existants observés — non exhaustifs

| Domaine | Éléments repérés dans le dépôt | Limite de l'observation |
|---|---|---|
| Identité et fonctions internes | `public.profiles`, champ `fonction_interne` ; la migration 072 accepte notamment `comptable`, `caisse`, `pharmacien`, `gestionnaire_stock`, `magasinier`. | La table d'appartenance canonique et ses colonnes n'ont pas encore été déterminées de façon suffisamment complète pour adapter `compta_peut`. Ne pas supposer l'existence de `membre_pharmacie`. |
| Périmètre Promoteur/pharmacie | `public.promoteur_pharmacies(promoteur_id, pharmacie_id, actif, created_at)`, migration 024. | Cette table décrit le lien Promoteur/pharmacie ; elle ne prouve pas qu'elle est la bonne source pour les droits Comptable. |
| Ventes et paiements | Les migrations existantes font référence à `public.ventes` et `public.vente_paiements` ; migration 058 définit `vente_ajouter_paiement`. | Le point d'émission sûr d'événements comptables doit être déterminé à partir du flux métier complet avant tout branchement. |
| Catalogue | `public.produits` existe ; migration 002 étend le catalogue. | Aucun champ de régime TVA par catégorie n'a été confirmé dans les fichiers consultés. Il ne faut pas en inventer. |
| Coûts de stock | `public.stocks_couts(pharmacie_id, produit_id, cout_unitaire, devise, updated_at)`, migration 013. | Le coût courant seul ne garantit pas le coût historique au moment d'une vente. |
| Lots et péremption | `public.stocks_lots`, migration 043 ; tables opérationnelles de stock existantes. | Les règles de valorisation comptable et points d'événement restent à confronter au cahier prioritaire. |
| Trésorerie et dépenses | Migrations 053 : `tresorerie_comptes`, `categories_depenses`, `depenses`, `tresorerie_mouvements`. | Fondation existante, mais aucun moteur comptable `compta_*` n'a été confirmé par les chemins inspectés. |
| Service | Migrations 188 (service Pharmacien) et 193 (service Gestionnaire de stock). | Elles ne doivent pas être réutilisées comme sessions de caisse ou sessions comptables sans spécification explicite. |
| Paie/RH et immobilisations | Aucun socle comptable correspondant n'a été confirmé dans les chemins inspectés. | Cela ne prouve pas leur absence totale du dépôt ; audit exhaustif non effectué en raison du blocage documentaire. |

## 3. Écarts et risques immédiats

1. Les sources normatives demandées sont introuvables aux chemins testés : impossible de garantir l'ordre cahier > design > code.
2. La migration 072 définit un privilège `MANAGE_ACCOUNTING`, mais son existence ne prouve pas que les droits sont limités conformément au moindre privilège.
3. Les migrations d'assurances et de trésorerie sont des fondations ERP, pas une preuve d'un grand livre SYSCOHADA.
4. Le schéma TVA, les paramètres fiscaux validés, le mapping SYSCOHADA, le journal comptable immuable et la boîte d'envoi `compta_evenement` restent à confirmer dans un audit complet.
5. Aucun changement de schéma, aucune migration SQL, aucun moteur de calcul, aucune interface, aucun test SQL ou Vitest et aucune recette n'ont été exécutés dans cette étape.

## 4. Fichiers existants touchés

**Aucun fichier applicatif ou migration existante n'a été touché.** Ce rapport est le seul fichier créé.

## 5. Tests et vérifications

- Vérification de présence des trois documents dans les chemins racine et `docs/compta/` : **introuvables**.
- Lecture de fichiers ciblés de migrations existantes : **partielle**.
- CI : **non exécutée et non consultée**, conformément à la demande.
- SQL, Vitest, lint, typecheck, build, tests E2E et vérification de base active : **non exécutés**.

## 6. Suite proposée après levée du blocage

1. Reprendre les trois sources exactes et relever les critères du cahier et le moteur déjà testé.
2. Achever l'inventaire des tables, colonnes, RLS, fonctions RPC, événements métier et régime TVA.
3. Confirmer la table et les colonnes canoniques d'appartenance/pharmacie avant d'écrire `compta_peut`.
4. Présenter les écarts et questions bloquantes restants dans ce rapport avant toute migration.
5. N'entamer l'étape 1 qu'une fois l'audit complet et les incompatibilités résolues.

## 7. Validation demandée

Fournir ou localiser les trois fichiers de référence nommés dans la consigne. Aucune migration ne sera appliquée et aucun moteur ne sera recopié ou réécrit avant ce point.
