# Recette 08 — Messagerie, notifications, posologie et historiques Client

- Dépendance : Recette 09 validée sur ses critères P1.
- Replay uniquement ; contenus médicaux fictifs.

## Cas bulk
1. Conversations : liste, recherche, conversations actives/archivées et états vides.
2. Ouverture fil lié à pharmacie/réservation/examen ; aucun fil sans contexte si le produit ne le permet pas.
3. Lecture, réponse, anonymat si autorisé, marquer lu, archiver et restaurer.
4. Isolation des conversations entre Clients et entre pharmacies.
5. Notifications : chargement, lecture, marquer lu, navigation vers la cible, lien expiré et cible supprimée.
6. Push : permission accordée/refusée, abonnement, désabonnement, appareil multiple et réception navigateur.
7. SMS/e-mail : préférences et états ; ne pas confondre préférence locale avec livraison effective.
8. Posologie : création médicament/dose/unité/fréquence, heures fixes, intervalle et validation.
9. Préremplissage OCR : champs reconnus, erreurs, correction obligatoire et saisie manuelle.
10. Rappels : autorisation, programmation, déclenchement, report, désactivation, suppression et reprise après redémarrage.
11. Historique : filtres période/type/recherche, détail, reçus, impression/PDF/téléchargement.
12. Isolation : Client A ne lit ni notification, ni message, ni historique, ni document du Client B.
13. États de panne : réseau, Push indisponible, session expirée, permission retirée, doublons et reprise.

## Limites
La preuve de réception Web Push Chrome ne vaut pas preuve FCM sur téléphone Android physique. Les rappels locaux ne prouvent pas une notification serveur. L'OCR ne constitue pas un diagnostic médical.

## Preuves
UI Playwright + assertions API/RLS + réception réelle du canal testé + état DB + nettoyage Replay.

État initial : NON EXÉCUTÉE.
