# Rapport d’étape 8 — Clôtures, exports et audit

Date : 21 octobre 2026  
Branche : `main`  
Référence : `docs/CAHIER_DES_CHARGES_COMPTE_COMPTABLE.md` et décision de l’étape 8 « Clôtures, exports, audit ».  
Statut : **EN COURS — contrôles de clôture et exports complémentaires intégrés, certification complète non acquise**.

## 1. Contrôles de clôture

Migration additive : `supabase/migration_20261025_compta_cloture_etape8.sql`.

- Ajout de `compta_controles_cloture`, rattachée à une pharmacie et à une période.
- Contrôles documentés : dotations, paie, TVA, stock, rapprochements ; clôture annuelle : régularisations et à-nouveaux.
- Une validation doit conserver une référence de preuve et un acteur/horodatage. Une non-applicabilité exige un motif explicite ; elle n’est pas assimilée à une validation métier.
- `compta_cloturer_periode` est réservée à `service_role`, vérifie l’acteur actif et rattaché à la pharmacie, exige les contrôles attendus, refuse les événements comptables non traités/en erreur, vérifie l’équilibre des écritures, vérifie la chaîne d’audit, puis clôture la période et journalise l’action.
- Les écritures sources restent immuables. Une période déjà clôturée ne peut pas être clôturée une seconde fois.

Limite : le schéma consulté ne confirme pas de module de paie ni de registre autonome de dotations. La clôture doit donc rester bloquée tant qu’une preuve vérifiable ou une non-applicabilité documentée n’est pas fournie. Le mécanisme de clôture n’est pas déclaré opérationnel de bout en bout : aucun profil métier n’existe dans la base isolée pour tester une période réelle.

## 2. Exports ajoutés

Les exports CSV/XLSX/PDF existants sont étendus avec :

- **Grand livre** : détail des lignes par date, journal, compte, libellé, débit et crédit.
- **Balance comptable** : totaux débit/crédit et soldes débiteurs/créditeurs par compte.
- Les montants du grand livre et de la balance sont agrégés en entiers `bigint` pour éviter une perte de précision JavaScript.
- Les filtres sur les colonnes date SQL de type `date` utilisent maintenant des dates ISO sans horodatage.
- Les contrôles d’authentification, de privilège, de pharmacie, la prévention de l’injection de formules, les métadonnées et la journalisation d’export sont conservés.

Non encore livrés comme états comptables complets :
- **Bilan et résultat** : la classification des comptes et les règles de présentation doivent être validées ; aucun mapping réglementaire implicite n’est appliqué.
- **TVA** : aucune source TVA enregistrée exploitable ni mapping fiscal validé n’a été confirmé. Aucun taux ni montant de TVA n’est calculé ou supposé.
- **Paie** : aucune table métier de paie n’a été confirmée ; aucun détail de paie personnel n’est créé ou exporté.

Ces quatre états restent des écarts ouverts à traiter à partir de sources et mappings confirmés, et non de données reconstituées arbitrairement.

## 3. Vérification de la chaîne d’audit

- La page `/pharmacie/comptable/journal-audit` appelle désormais `compta_verifier_audit` et affiche distinctement chaîne vérifiée, chaîne invalide ou vérification indisponible.
- Un échec de vérification n’est pas présenté comme une preuve d’altération ; une erreur d’accès ou de disponibilité reste distincte.
- Le test isolé a interrogé les 6 pharmacies de test : les 6 chaînes vides ont été acceptées comme valides (0 invalide). Cela valide seulement le cas sans événement, pas le rejeu d’une chaîne contenant des événements ni une altération injectée.

## 4. Tests et environnement

- Migration `compta_cloture_etape8` : appliquée uniquement à la base isolée `naxa-ci-replay-2` (`pwfftcsjyeibxxqhwysw`).
- Test structurel `167_compta_cloture_etape8_structure.sql` : **PASS** sur la base isolée.
- Vérification de chaîne vide sur 6 pharmacies isolées : **6 valides, 0 invalide**.
- Profils de test : **0** ; aucune recette d’identité métier ni de clôture positive complète possible sur cette base.
- Tests UI/navigateur, lint, typecheck, build et compilation de la route export : **NON EXÉCUTÉS**.
- CI : **NON CONSULTÉE / NON LANCÉE**.
- Base Supabase active : **NON MODIFIÉE**.
- Déploiement : **NON EFFECTUÉ**.

## 5. Suite obligatoire avant clôture de l’étape 8

1. Construire le parcours UI/API de gestion des contrôles et de clôture, avec validation serveur et audit.
2. Ajouter un test transactionnel de clôture positive et des tests négatifs (contrôle manquant, événement en erreur, écriture déséquilibrée, chaîne invalide, acteur hors pharmacie), avec fixtures isolées.
3. Compléter bilan/résultat/TVA/paie seulement après confirmation des mappings et sources.
4. Ajouter des tests de chaîne d’audit avec événements successifs et altération contrôlée en transaction annulée.
5. Exécuter typecheck, lint, build et tests navigateur sur le HEAD exact, sans lancer la CI.
6. Mettre à jour le statut global du projet avec les mêmes limites explicites.

Aucun élément de ce rapport n’autorise une migration sur la base active ni un déploiement.
