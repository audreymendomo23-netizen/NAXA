# Rapport d'audit — Compte Comptable NAXA

Date : 2026-10-21  
Branche : `main`  
Source unique validée : `docs/CAHIER_DES_CHARGES_COMPTE_COMPTABLE.md` (SHA `99700259f7da546fd68e01256a724a9395da1182`).  
Statut : **AUDIT PARTIEL — écarts techniques identifiés ; aucun changement applicatif**.

## 1. Source de vérité

L'utilisateur a confirmé que les trois documents de préparation ont été fusionnés. Le seul cahier normatif pour ce chantier est `docs/CAHIER_DES_CHARGES_COMPTE_COMPTABLE.md`. Les fichiers séparés `01_...`, `02_...`, `03_...` ne sont donc plus attendus. Le cahier lui-même indique qu'il ne prouve pas que les écrans ou tests sont déjà implémentés.

## 2. Identité, rôles et périmètre

- Table d'identité repérée : `public.profiles`; champ métier `fonction_interne`.
- Migration `supabase/migration_072_fonctions_validation_distance.sql` autorise la fonction interne `comptable` et le privilège `MANAGE_ACCOUNTING`.
- Le code existant utilise aussi `public.can_access_pharmacy(pharmacie_id)`, `public.my_pharmacie()`, `public.is_admin()` et `public.naxa_scope_allows(...)`.
- `supabase/migration_024...` (nom à confirmer dans l'inventaire des migrations) décrit `promoteur_pharmacies(promoteur_id, pharmacie_id, actif, created_at)`; cette table n'est pas considérée comme table d'appartenance du Comptable sans preuve.
- **À confirmer avant l'étape 1** : le schéma complet de `profiles`, la fonction canonique déterminant la pharmacie du Comptable et les privilèges effectifs via RLS/RPC. Aucun accès comptable ne doit être accordé sur la seule base du code `MANAGE_ACCOUNTING`.

## 3. Modules et points d'accroche repérés

| Domaine | Éléments établis | Écart / précaution |
|---|---|---|
| Ventes / POS | `ventes`, `vente_lignes`, `caisses`, `caisses_sessions` dans `migration_044_pos_caisse.sql`; paiements étendus dans `migration_058_pos_paiements.sql`. | Émettre les événements uniquement après transition métier réussie, avec clé d'idempotence et date réelle de vente. |
| Assurances / tiers payant | `assureurs`, `couvertures_assurance`, `dossiers_assurance` dans `migration_052_assurances.sql`. | Montants de schéma en `numeric(14,2)` ; à traiter avec conversion contrôlée, sans flottants côté moteur. Les données de santé nominatives sont interdites au Comptable. |
| Trésorerie / dépenses | `tresorerie_comptes`, `categories_depenses`, `depenses`, `tresorerie_mouvements` dans `migration_053_tresorerie_depenses.sql`. | Les montants opérationnels sont majoritairement des entiers, devise XAF ; auditer les RPC d'écriture et leurs événements. |
| Stock / coûts | `stocks_couts(pharmacie_id, produit_id, cout_unitaire, devise, updated_at)` dans `migration_013_stocks_couts.sql`; `stocks_lots` dans `migration_043_stocks_lots.sql`; nombreuses migrations de mouvement/inventaire jusqu'à 214+. | Le coût courant ne suffit pas pour valoriser une vente passée ; les pertes/péremptions doivent être reliées aux mouvements transactionnels réels. |
| Fournisseurs / achats | Références à `fournisseurs` et `commandes_fournisseurs`, notamment `migration_197_fournisseurs_role_security.sql`. | Audit complet du cycle commande/réception/facture requis avant branchement. |
| Rôles | `profiles.role`, `profiles.fonction_interne`, tables de privilèges `naxa_role_privileges`, `naxa_architecture_privileges`, fonctions de périmètre. | Les droits Comptable effectifs et les colonnes exactes d'appartenance ne sont pas encore prouvés intégralement. |
| Paie / RH | Aucun module de paie complet n'a été confirmé dans les fichiers inspectés. | Ne pas créer d'événements de paie avant d'avoir trouvé le modèle réel ou constaté formellement son absence. |
| Immobilisations | Aucun module d'immobilisations comptables confirmé dans les chemins inspectés. | À concevoir dans le périmètre comptable si le cahier le requiert, sans inventer de données sources. |
| Catalogue / TVA | `public.produits` est référencé par le POS ; le coût de stock est séparé du prix public. | Aucun champ régime TVA par catégorie n'a été confirmé dans les fichiers consultés. Pas de taux par défaut. |
| Rapports | `src/app/api/rapports/route.ts`, `src/app/pharmacie/pilotage/rapports/page.tsx`. | Rapports génériques existants, non équivalents aux états comptables SYSCOHADA. |
| Caisse | `src/app/pharmacie/caisse/page.tsx`; migrations et tests spécialisés, dont `159_caisse_audit_chain_lock.sql`. | La comptabilité ne doit pas ouvrir/fermer la caisse ni écrire les encaissements. |

## 4. Écarts vis-à-vis du cahier unique

1. Aucun moteur `lib/compta/*` ni suite Vitest comptable n'a été trouvé dans l'inventaire récursif `main`.
2. Aucune migration `compta_*` ni table `compta_evenement`, `compta_balance`, `compta_mapping_compte` ou `compta_parametre` n'a été trouvée dans l'inventaire du dépôt.
3. Le privilège `MANAGE_ACCOUNTING` existe mais n'est pas à lui seul une autorisation suffisante pour écrire le grand livre.
4. Le schéma TVA et les mappings de comptes n'ont pas été confirmés ; tout paramètre absent devra rester « à renseigner » et alimenter « À traiter ».
5. Le cahier décrit le poste comme lecture/rapprochement/export et interdit les données de santé nominatives ; les policies existantes larges sur ventes/assurances doivent être contournées par des vues/RPC dédiées et non exposées directement au Comptable.
6. Les modules paie et immobilisations n'ont pas été établis dans cet audit ciblé ; leur absence doit être confirmée par un inventaire approfondi avant d'implémenter les événements.

## 5. Fichiers existants touchés

- Aucun module applicatif, aucune migration SQL opérationnelle, aucun test existant n'a été modifié.
- Ce rapport d'audit a été corrigé pour refléter la source unique de vérité confirmée par l'utilisateur.

## 6. Tests / limites

- Source unique lue sur `main` : **confirmée**, SHA ci-dessus.
- Inventaire récursif GitHub de l'arbre `main) : effectué.
- Lecture de migrations/fichiers métier : ciblée, pas exhaustive.
- SQL, base Supabase active, Vitest, lint, typecheck, build, E2E : **non exécutés**.
- CI : **non consultée et non exécutée**, conformément aux consignes.

## 7. Questions bloquantes restantes

1. Confirmer le schéma exact de `profiles` et la source canonique du rattachement du Comptable à une pharmacie avant de définir `compta_peut`.
2. Confirmer si une base Supabase de test est disponible et autorisée pour appliquer la migration ; aucun accès actif ni preuve d'application de migration n'a été établi dans cet audit.

Ces questions ne bloquent pas la préparation locale des migrations et tests, mais bloquent l'affirmation qu'une migration est appliquée en base active et que les tests RLS réels passent.
