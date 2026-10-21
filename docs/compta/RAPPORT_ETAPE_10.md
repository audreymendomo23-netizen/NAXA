# Rapport d'étape 10 — Recette renforcée du compte Comptable

Date : 21 octobre 2026  
Branche : `main`  
Environnement de validation : Supabase isolé `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`)  
Statut : **PARTIEL — garde-fous SQL PASS ; recette E2E réelle toujours bloquée par les prérequis de données et de parcours.**

## 1. Contrat appliqué

Le cahier de référence reste `docs/CAHIER_DES_CHARGES_COMPTE_COMPTABLE.md` et le cahier ERP v3.7. Le Comptable reste un poste de consultation, rapprochement et export : aucune permission générale d'encaisser, modifier les ventes, changer le stock, créer des dépenses ou clôturer une caisse n'est ajoutée.

Aucune donnée de démonstration persistante n'a été créée. Aucun changement n'a été fait dans le projet Supabase actif `eouwtuusnsuxaejsxknf`. Aucun déploiement, aucune CI et aucun pipeline n'ont été consultés ou lancés.

## 2. Travail réalisé

- Ajout de `supabase/tests/171_compta_recette_etape10_hardening.sql`.
- Le test vérifie les triggers d'immuabilité du journal et des écritures, la contrainte différée de partie double, RLS sur les tables comptables sensibles, l'absence de droits d'écriture directs `authenticated`, et la séparation des droits serveur sur ouverture/clôture.
- Le test détecte et signale aussi l'absence de sources confirmées de paie et d'immobilisations/amortissements ; il ne transforme pas ces lacunes en contrôles « validés ».
- Rejeu sur la base isolée des tests 167, 168, 169, 170 et 171 : les cinq ont retourné leur marqueur PASS.

## 3. Résultats SQL observés

| Test | Verdict | Portée réelle |
|---|---|---|
| 167 — structure de clôture | PASS | Privilèges et contrôles structurels |
| 168 — intégrité de chaîne d'audit | PASS | Chaîne valide acceptée, altération simulée détectée et rollback |
| 169 — RPC contrôles de clôture | PASS | Garde-fous structurels |
| 170 — sécurité recette étape 9 | PASS | RLS et privilèges des RPC |
| 171 — durcissement étape 10 | PASS | Immutabilité, partie double différée, RLS et séparation de tâches |

Un PASS structurel ne prouve pas un parcours E2E authentifié.

## 4. État de la base de test et blocages

Le contrôle antérieur a relevé six pharmacies mais zéro profil, vente, ligne de vente, dépense, mouvement de trésorerie, dossier d'assurance, période comptable, écriture, ligne comptable ou compte du plan. Il n'existe donc pas d'identité Comptable/Caissier test préexistante pour prouver les autorisations positives et négatives par session.

L'historique de migrations observé sur cette base passe du socle 132 à la série 157 et aux séries ultérieures, alors que la chaîne du dépôt contient des migrations 133–156. La base de test est donc un environnement de diagnostic avec historique non canonique, et non une preuve de rejeu propre de `main`. Je n'ai pas appliqué aveuglément ces migrations manquantes dans une base où des migrations ultérieures sont déjà enregistrées : leur ordre et leurs dépendances doivent être réconciliés avant correction.

Les sources dédiées et confirmées pour bulletins de paie et immobilisations/amortissements ne sont pas présentes. La clôture positive complète doit donc rester bloquée tant que les sources et mappings n'existent pas ou ne sont pas explicitement validés.

## 5. Matrice de recette — état après étape 10

| Scénario | Verdict | Motif |
|---|---|---|
| Pharmacie vide, aucun chiffre fictif | PARTIEL | État de base vide constaté ; navigateur non exécuté |
| Vente mixte → événement/écriture équilibrée | NON EXÉCUTÉ | Aucun parcours POS authentifié avec identité de test |
| Achat fournisseur → rapprochement | NON EXÉCUTÉ | Aucun parcours métier authentifié avec données créées par l'interface |
| Perte/sortie de stock | NON EXÉCUTÉ | Parcours et intégration comptable non exécutés de bout en bout |
| Écart de caisse signalé sans altérer la clôture | NON EXÉCUTÉ | Pas de session E2E authentifiée |
| Bulletin de paie | BLOQUÉ | Source métier confirmée absente |
| Immobilisation et amortissement | BLOQUÉ | Registre métier confirmé absent |
| Clôture bloquée si contrôles manquants | PARTIEL | RPC et garde-fous structurels PASS ; pas de scénario métier avec profil |
| Clôture réussie après résolution des contrôles | BLOQUÉ | Identités/écritures absentes et sources paie/immobilisations manquantes |
| Contrepassation et audit | PARTIEL | Immutabilité et chaîne d'audit structurelles PASS ; aucune écriture réelle à contrepasser |
| Exports PDF/XLSX/CSV | PARTIEL | Code et métadonnées présents ; téléchargement navigateur non exécuté |
| Séparation inter-pharmacies et absence de données de santé dans exports | PARTIEL | RLS/structure PASS ; test par identités réelles et export navigateur non exécuté |

## 6. Contrôles de sécurité Supabase complémentaires

Les conseillers Supabase ont remonté des observations sur plusieurs domaines de l'application, dont une vue `public.v_reservations_ca` détectée comme SECURITY DEFINER, des fonctions SECURITY DEFINER exécutables par `anon`, des tables RLS sans policy et des index dupliqués. Ces constats dépassent le seul compte Comptable ; ils ne sont pas corrigés à l'aveugle dans ce lot, car chaque correction doit respecter le contrat public existant et être accompagnée de tests de non-régression. Les liens de remédiation officiels sont ceux des avis Supabase correspondants.

## 7. Contrôles encore non exécutés

- Vitest et couverture à 100 %.
- Typecheck, lint et build Next.js sur le HEAD exact.
- Tests navigateur/E2E avec connexion et parcours UI réels.
- Téléchargement et inspection des exports PDF/XLSX/CSV.
- Rejeu canonique complet des migrations dans un environnement propre.
- Les scénarios métier paie et immobilisations tant que les sources restent absentes.

CI non consultée ni exécutée, conformément à la consigne. Aucun déploiement.

## Conclusion

**Étape 10 : PARTIELLE, non certifiée.** Les tests SQL 167–171 passent sur l'environnement de diagnostic. La recette E2E demandée ne peut pas être déclarée verte sans identités de test utilisables par de vrais parcours UI et sans les sources métier absentes. La base active demeure inchangée.