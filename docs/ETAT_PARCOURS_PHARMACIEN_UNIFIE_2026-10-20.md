# État du parcours Pharmacien unifié — 20 octobre 2026

## Décision métier
- Un seul poste interne : **Pharmacien**.
- Le poste Assistant pharmacien est supprimé comme fonction distincte.
- Une interface opérationnelle unique : `/pharmacie/pharmacien`.
- L'ancienne URL `/pharmacie/assistant` redirige vers l'espace Pharmacien pour conserver les anciens liens.
- Les comptes qui portaient `fonction_interne='pharmacien_assistant'` sont convertis vers `pharmacien` par la migration 127.

## Les 10 entrées du panneau latéral
1. Tableau de bord
2. Consultations
3. Prescriptions
4. Ordonnances
5. Préparations
6. Suivi des dispositifs Patient — ouvre le parcours existant `/suivi`
7. Historique — aperçu des dossiers récents disponibles ; journal d’audit exhaustif à construire
8. Rapports et Performances — indicateurs de situation sur les données chargées ; rapports consolidés à construire
9. Profil
10. Déconnexion

Les entrées 1 à 5 et 7 restent dans l'espace Pharmacien. L'entrée 6 ouvre la page de suivi des dispositifs existante et requiert une connexion ; la déconnexion est une action du panneau latéral.


## Parcours cible — Historique
1. Ouvrir l’historique et choisir une période, un type d’événement et un statut.
2. Rechercher un dossier par référence, puis consulter une fiche chronologique.
3. Afficher chaque événement avec date/heure, acteur, action, résultat et motif, selon les droits du rôle.
4. Ouvrir le dossier source sans recopier inutilement les données de santé.
5. Pour les actions sensibles, conserver une trace non modifiable et journaliser les consultations/exports.

**Fonctions prioritaires à construire :** journal serveur append-only couvrant consultations, prescriptions, décisions, demandes de complément, préparations, délivrances et exports ; filtres/pagination ; fiche de détail ; traçabilité de l’auteur et des changements ; contrôle d’accès par pharmacie et rôle ; rétention et protection des données. La vue actuelle liste seulement les dossiers récents disponibles et ne prouve pas encore l’existence de ce journal exhaustif.

## Parcours cible — Rapports et Performances
1. Choisir une période et comparer à la période précédente.
2. Voir les volumes reçus, validés, rejetés, en attente et nécessitant un complément.
3. Mesurer les délais entre réception, examen, décision et délivrance, avec médiane et percentiles plutôt qu’un seul chiffre moyen.
4. Examiner les motifs récurrents de rejet/complément et les périodes de surcharge.
5. Relier les indicateurs aux stocks/ruptures et à la Marketplace uniquement après vérification des sources et des droits.
6. Exporter un rapport PDF/CSV avec période, filtres, horodatage et journalisation.

**Différenciation NAXA recommandée :** pilotage de bout en bout entre ordonnance, disponibilité réelle du stock, réservation Marketplace, retrait en pharmacie et suivi patient consenti ; alertes explicables plutôt que scores opaques ; tableaux mobile-first adaptés aux connexions irrégulières ; indicateurs calculés côté serveur et non inventés côté interface.

**Données et limites actuelles :** la vue Rapports affiche uniquement des compteurs calculés sur les données déjà chargées par l’écran. Elle n’est pas encore un rapport historique fiable ; délais, tendances, taux de performance, export et liaison au stock nécessitent des données historisées, des tests SQL/RLS et une validation métier.

## Fichiers modifiés
- `src/app/pharmacie/pharmacien/page.tsx` : interface commune avec consultation, prescription, préparations et décisions d'ordonnance.
- `src/components/pharmacie/PharmacienWorkspaceSidebar.tsx` : panneau latéral responsive à dix entrées, dont le lien vers `/suivi`, Historique et Rapports et Performances.
- `src/app/pharmacie/assistant/page.tsx` : redirection de compatibilité vers l'interface commune.
- `src/app/pharmacie/page.tsx` : retrait du lien séparé Assistant pharmacien.
- `supabase/migration_127_unified_pharmacien_role.sql` : conversion des profils, contrainte sans fonction Assistant, renommage de la colonne d'acteur de préparation et RPC Pharmacien pour préparation et décision.

## Limites de vérification
- Les changements sont enregistrés sur `main`.
- La migration 127 n'a pas été appliquée à Supabase.
- Aucun build, lint, typecheck, test automatisé ou test SQL n'a été exécuté dans cette passe.
- Aucun déploiement n'a été lancé.
- Le code est donc modifié, mais le parcours n'est pas encore prouvé en exécution. La migration doit être testée/appliquée avant que les profils convertis et la nouvelle RPC fonctionnent sur la base.
