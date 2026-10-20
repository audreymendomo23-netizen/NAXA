# État du parcours Pharmacien unifié — 20 octobre 2026

## Décision métier
- Un seul poste interne : **Pharmacien**.
- Le poste Assistant pharmacien est supprimé comme fonction distincte.
- Une interface opérationnelle unique : `/pharmacie/pharmacien`.
- L'ancienne URL `/pharmacie/assistant` redirige vers l'espace Pharmacien pour conserver les anciens liens.
- Les comptes qui portaient `fonction_interne='pharmacien_assistant'` sont convertis vers `pharmacien` par la migration 127.

## Navigation Pharmacien — regroupement des entrées

Le panneau latéral expose sept entrées de premier niveau et conserve toutes les vues métier sous des groupes repliables :

1. **Tableau de bord**
2. **Activité pharmaceutique** : Consultations, Préparations
3. **Prescriptions et ordonnances** : Prescriptions, Ordonnances
4. **Suivi des patients** : mesures partagées et consenties
5. **Historique et rapports** : Historique, Rapports et performances
6. **Prise / fin de service** : pointage Pharmacien, distinct des sessions de caisse
7. **Profil**
8. **Déconnexion** : action de session séparée en bas du panneau

Les sous-entrées disposent chacune d’une URL dédiée et la navigation reste responsive. Le libellé **Prise / fin de service** est identique à celui du compte Caisse, mais la logique métier et les tables restent distinctes.

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
- `src/components/pharmacie/PharmacienWorkspaceSidebar.tsx` : panneau latéral responsive à neuf entrées métier et Déconnexion, navigation par URL.
- `src/components/pharmacie/PharmacienWorkspaceShell.tsx` : coquille responsive séparant navigation et contenu.
- `src/components/pharmacie/PharmacienWorkspace.tsx` : contenu métier partagé entre les routes du workspace.
- `src/app/pharmacie/pharmacien/[section]/page.tsx` : route dynamique des sections du workspace.
- `src/app/pharmacie/pharmacien/suivi-patients/page.tsx` : route dédiée affichant honnêtement l’état non connecté du suivi patient.
- `src/app/pharmacie/assistant/page.tsx` : redirection de compatibilité vers l'interface commune.
- `src/app/pharmacie/page.tsx` : retrait du lien séparé Assistant pharmacien.
- `supabase/migration_127_unified_pharmacien_role.sql` : conversion des profils, contrainte sans fonction Assistant, renommage de la colonne d'acteur de préparation et RPC Pharmacien pour préparation et décision.

## Limites de vérification
- Les changements sont enregistrés sur `main`.
- La migration 127 n'a pas été appliquée à Supabase.
- Aucun build, lint, typecheck, test automatisé ou test SQL n'a été exécuté dans cette passe.
- Aucun déploiement n'a été lancé.
- Le code est donc modifié, mais le parcours n'est pas encore prouvé en exécution. La migration doit être testée/appliquée avant que les profils convertis et la nouvelle RPC fonctionnent sur la base.

## Alignement architectural avec le compte Caisse — 20 octobre 2026

- Ajout de `src/components/pharmacie/PharmacienWorkspaceShell.tsx`, calqué sur le principe de `CaisseWorkspaceShell` : la coquille responsive porte le panneau latéral et le conteneur de contenu ; elle ne porte pas la logique métier.
- Extraction du contenu opérationnel vers `src/components/pharmacie/PharmacienWorkspace.tsx`, réutilisé par la route principale et les routes de sections.
- `/pharmacie/pharmacien` ouvre le tableau de bord ; `/pharmacie/pharmacien/[section]` porte les sections Consultations, Prescriptions, Ordonnances, Préparations, Historique, Rapports et Profil.
- `/pharmacie/pharmacien/suivi-patients` est une route explicite et prioritaire, distincte du suivi personnel client `/suivi`. Elle affiche un avertissement d'absence de connexion aux données patients au lieu de présenter à tort le tableau personnel comme un suivi professionnel.
- La vérification du profil dans le workspace exige maintenant `actif === true` et la fonction interne `pharmacien`.

### Limites de validation après refonte

- Modifications poussées directement sur `main` ; aucun déploiement lancé.
- Build, lint, typecheck, tests E2E et tests SQL non exécutés dans cette passe.
- La nouvelle architecture de navigation est en place dans le code source, mais son exécution n'est pas déclarée validée tant que ces contrôles ne sont pas lancés.
- Le suivi partagé des patients, les consentements professionnels, les alertes temps réel et l'intégration des prescriptions restent à implémenter et vérifier côté serveur/RLS avant usage réel.

## Avancement additionnel — navigation, suivi partagé et service

- `src/components/pharmacie/PharmacienWorkspaceSidebar.tsx` : regroupement repliable des entrées, sous-routes dédiées, menu mobile, déconnexion Supabase.
- `src/components/pharmacie/PharmacienWorkspace.tsx` : validation côté interface des champs essentiels, motif obligatoire au rejet, filtres combinables de l’historique (recherche/type/période) et filtres de période pour les compteurs de rapport.
- `src/app/pharmacie/pharmacien/service/page.tsx` : prise et fin de service, note de transmission, historique et durée calculée à partir des horodatages serveur.
- `supabase/migration_188_pharmacien_service_sessions.sql` : stockage isolé des pointages Pharmacien, contrainte empêchant plusieurs services ouverts par compte, RPC sécurisées et RLS.
- `supabase/tests/188_pharmacien_service_sessions.sql` : assertions de structure/RLS/index/RPC à exécuter dans la suite SQL.
- `src/app/pharmacie/pharmacien/suivi-patients/page.tsx` : lecture des partages actifs, onglets Patients partagés / Mesures / Partages et accès, filtres et affichage anonymisé par défaut.
- `supabase/migration_189_pharmacien_read_consented_measurements.sql` : politique de lecture des mesures limitée au destinataire professionnel vérifié, au partage actif du type exact et au consentement encore valide.
- `supabase/tests/189_pharmacien_read_consented_measurements.sql` : assertions sur les politiques de partage et les fonctions de consentement.
- `supabase/migration_190_pharmacien_audit_trail.sql` : journal append-only et déclencheurs sur les créations/mises à jour de consultations, prescriptions et préparations.
- `supabase/tests/190_pharmacien_audit_trail.sql` : assertions sur la table, les déclencheurs, le verrouillage et la RLS.

### Limites restant à prouver ou compléter

- Les migrations 188 et 189 sont dans le dépôt, mais n’ont pas été exécutées sur Supabase ; tant qu’elles ne sont pas appliquées, le pointage et la lecture professionnelle des mesures partagées peuvent signaler un schéma ou une politique manquante.
- Le suivi connecté reste limité par l’allowlist expérimentale et la vérification professionnelle existantes. Ce changement ne désactive pas ces garde-fous.
- Les rapports utilisent encore un échantillon de dossiers chargés (jusqu’à 30 pour certaines listes), et non une agrégation historique serveur. Le journal append-only est désormais défini pour les consultations, prescriptions et préparations, mais son exécution réelle dépend de la migration 190 et de la validation des tests. Les délais fiables, les comparaisons de période complètes, les exports audités, les alertes partagées et le suivi de prescriptions patients ne sont pas encore terminés.
- Aucun build, lint, typecheck ou test SQL n’a été exécuté dans cette passe. Les assertions SQL ajoutées ne valent pas preuve d’exécution.
- Aucun déploiement n’a été lancé.
