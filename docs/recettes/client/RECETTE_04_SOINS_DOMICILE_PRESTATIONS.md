# Recette 04 — Soins à domicile et Prestations (profil Client)

- Dépendance : Recette 09 validée sur ses critères P1.
- Replay uniquement ; aucun prestataire ni client réel.

## Cas bulk
1. Catalogue publié : recherche, suggestions, catégories, filtres et remise à zéro.
2. Fiche prestation : spécialité, zone desservie, tarif, disponibilité et coordonnées.
3. Proximité GPS : autorisé, refusé, indisponible, rayon variable et absence de coordonnées.
4. Demande : prestation, adresse, téléphone, date/heure souhaitée, note et coordonnées.
5. Partage GPS facultatif : consentement explicite, refus et révocation.
6. Validation des données, date passée, adresse manquante, téléphone invalide et prestataire hors zone.
7. Soumission, confirmation, suivi et historique.
8. Annulation autorisée/interdite selon statut ; double clic et requête répétée.
9. Notifications et liens profonds liés à la demande.
10. Assistance depuis le suivi connecté : origine et contexte correctement conservés.

## Contrôles contradictoires
Profil global suspendu, rôle non Client, identité Client incomplète, session expirée, prestataire désactivé, RPC refusant l'appel. Vérifier Server Action ET RPC/RLS ; une simple vérification de session ne suffit pas.

## Preuves
UI Playwright + réponse RPC + état DB + vérification de l'identité/du périmètre + nettoyage Replay.

État initial : NON EXÉCUTÉE.
