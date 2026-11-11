# Audit et mise en œuvre — ERP autonome Examens (11 novembre 2026)

## Périmètre traité

Cette tranche ajoute un ERP Examens autonome dans le projet NAXA, distinct des droits Pharmacie, avec sélection d'un poste actif par centre.

### Architecture livrée

- Espace centre : /centre-examens, navigation par poste, tableau quotidien et sélecteur de centre.
- Postes définis : Direction, Accueil, Caisse, Comptabilité, Technicien laboratoire, Biologiste, Manipulateur imagerie, Radiologue, Responsable qualité et Responsable sécurité.
- Modules : Agenda, Personnel, Résultats, Équipements, Comptabilité, Sécurité, Messagerie et Actions assistées.
- Admin : enrichissement de /admin/examens (intégré à la navigation Admin existante) avec indicateurs agrégés, personnels, résultats sous forme de métadonnées, incidents, équipements, journal d'accès aux résultats et journal d'actions assistées.
- Client : /client/examens accessible depuis les opérations actives; tickets, résultats publiés, pièces jointes, notifications et conversations.
- Catalogue public : filtre ville, tri prix, disponibilité des créneaux et distance après consentement GPS ponctuel.

## Base et migrations Replay

Projet de vérification : pwfftcsjyeibxxqhwysw (naxa-ci-replay-2), statut observé ACTIVE_HEALTHY.

Migrations appliquées et versions confirmées dans schema_migrations :

1. 20261111065609_exam_center_erp_foundation
2. 20261111072503_exam_admin_monitoring_policies
3. 20261111073753_exam_appointment_transition_invoker

### Contrôles SQL exécutés

- 21 tables exam_* avec RLS active.
- 75 politiques RLS exam_*.
- 13 politiques d'accès Admin sur les métadonnées opérationnelles.
- Contrainte d'unicité exam_centers.partner_id supprimée : un partenaire peut avoir plusieurs centres.
- Bucket exam-results privé (public=false).
- RPC exam_set_active_role, exam_create_result_draft et transition_exam_appointment vérifiées en SECURITY INVOKER.
- Smoke test SQL : PASS (ERP, RLS, multi-centres, stockage privé et transitions SECURITY INVOKER).
- Transition annulée : trigger contrôle les transitions autorisées, libère le créneau dans la même transaction et journalise le changement.
- Résultats : métadonnées séparées du contenu médical; validation professionnelle distincte de la publication; pièces accessibles via URL signée de 60 secondes; journal des téléchargements.

## Sécurité métier

- Permissions fondées sur exam_staff_assignments, centre, poste actif et profil actif; aucun privilège Pharmacie réutilisé.
- Une seule affectation active par utilisateur et centre.
- Les résultats ne sont visibles au Client qu'après publication.
- L'Admin réseau voit les métadonnées de suivi, pas le texte médical ni les fichiers.
- Incidents : NOUVEAU → EN_ANALYSE → CONFINEMENT/CORRECTION → SURVEILLANCE → CLOTURE.
- Comptabilité centre enregistrée sous center_id, avec brouillon puis approbation humaine.
- Les actions assistées sont auditées; les rappels sont préparés puis confirmés par un humain.
- L'assistant livré est déterministe, sans appel LLM externe dans cette tranche. Il ne pose aucun diagnostic, n'interprète aucun résultat et ne publie aucun compte rendu.

## Éléments non validés / réserves

Le Replay observé ne contient aucun partenaire, membre partenaire, centre ou rendez-vous :
- partners = 0
- partner_members = 0
- exam_centers = 0
- exam_appointments = 0

En conséquence, les parcours de réservation, authentification multi-postes, admission, validation clinique, accès Client, téléchargement, comptabilité et messagerie n'ont pas pu être exécutés en E2E avec des utilisateurs et données métier réels. Le statut de ces recettes reste À EXÉCUTER.

Autres limites fonctionnelles à ne pas masquer :
- La comptabilité actuelle est un journal d'événements recettes/dépenses avec validation et synthèse; elle ne constitue pas encore un grand livre en partie double, avec plan de comptes, clôture de période et exports réglementaires.
- Les actions assistées sont déterministes et auditées; aucune intégration IA générative n'est activée.
- Le module équipement accepte une URL d'image et impose source/licence renseignées, mais aucune galerie de photos réelles n'a été importée ou validée.
- L'affectation relie un compte NAXA déjà existant; cette tranche ne crée pas un compte Auth ni un processus d'invitation autonome.
- Les rappels sont exécutés manuellement depuis le module Actions assistées après confirmation; aucun ordonnanceur/notification Android push n'est validé ici.
- Build Next.js, TypeScript, lint et E2E n'ont pas été exécutés depuis un environnement de build du dépôt dans cette passe.

## Décision de sortie

État : socle Replay intégré et vérifications SQL vertes; recette métier et build global non clôturés.

Pas de migration Production, pas de modification des données Production et pas de déploiement Production dans cette intervention.
