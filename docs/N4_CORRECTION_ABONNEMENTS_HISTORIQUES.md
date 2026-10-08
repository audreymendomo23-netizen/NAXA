N4 - Correction replay SQL - abonnements historiques

Date : 08/10/2026

Diagnostic
Le replay CircleCI atteignait migration_009_pilotage_360.sql puis échouait sur public.abonnements absent.

Contradiction vérifiée : migration_009 consomme public.abonnements ; migration_010 l'altère et crée public.abonnement_paiements ; migration_019 conserve explicitement ces objets pour compatibilité historique avant de construire le modèle canonique Promoteur ; migration_039 référence encore public.abonnements.

Correction
Ajout de supabase/migration_001_legacy_abonnements_compat.sql avant migration_002, donc avant migration_009. Elle restaure uniquement la couche historique requise par les migrations existantes. Le modèle Promoteur de migration_019 reste inchangé.

Régression
Ajout de supabase/tests/000_legacy_abonnements_replay.sql pour vérifier l'existence de public.abonnements, public.abonnement_paiements après 010 et de pharmacie_id.

Preuve
Commits : 2cede5096cd8c56b0443e7192cf2a903fdfc8e2a puis 38fb6af48e42421bb11ce17a801b895ff8f2426b.

N4 reste en attente de preuve jusqu'au replay CircleCI complet au HEAD courant et a tous les tests SQL.
Aucun merge vers main. Aucun déploiement Production.
