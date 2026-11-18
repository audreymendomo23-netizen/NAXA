# Recette 03 — Examens médicaux (profil Client)

- Dépendance : Recette 09 validée sur ses critères P1.
- Replay uniquement ; données médicales synthétiques de test exclusivement.

## Cas bulk
1. Catalogue : recherche centre/examen/pack, suggestions, filtres, tri, ville et proximité.
2. GPS : autorisé, refusé, indisponible, position imprécise et changement de ville.
3. Fiche centre : services, tarifs, horaires, créneaux et coordonnées.
4. Réservation examen simple et pack ; créneau libre, complet, expiré ou supprimé pendant le checkout.
5. Validation des champs, double clic, soumission répétée et conflit de capacité.
6. Confirmation, ticket, code, statut et détail du rendez-vous.
7. Modification/annulation selon transitions autorisées et conséquences sur capacité.
8. Notifications : réception, lecture, lien profond, permission refusée et préférences.
9. Résultats : brouillon/non publié, publié, retiré, téléchargement, URL expirée et refus d'accès.
10. Messagerie liée au rendez-vous : ouverture, lecture, réponse, archivage et isolation.
11. Paiement : confirmer que le règlement est direct auprès du centre, sans encaissement NAXA.

## Cas de sécurité
Client A tente d'accéder aux tickets, résultats, fichiers et conversations de Client B ; utilisateur non connecté ; identité suspendue ; rendez-vous d'un autre centre ; lien signé expiré.

## Preuves
Parcours UI complet + contrôles RLS/API + état réservation/capacité + preuves d'isolation + nettoyage Replay.

État initial : NON EXÉCUTÉE.
