# Recette 06 — Univers bloqués : Parapharmacie et Bébé & Maman

- Dépendance : Recette 09 validée et verrouillage serveur confirmé.
- Ces univers restent **BLOQUÉS MÉTIER**. La recette vérifie le refus et l'absence d'effets, pas l'ouverture commerciale.

## Cas bulk
1. Menu : univers absents ou explicitement verrouillés conformément à la décision métier.
2. URL directe catalogue, fiche produit et réservation : refus propre, pas de crash.
3. Appels API et Server Actions de catalogue : refus côté serveur.
4. Appels directs des actions de réservation unitaire et groupée : refus côté serveur/RPC.
5. Tentative avec univers absent, identifiant forgé ou statut modifié côté client.
6. Panier local préexistant : aucun checkout ni transfert silencieux vers le panier principal.
7. Rechargement, session expirée et changement de rôle : le blocage persiste.
8. Vérifier qu'aucune réservation, ligne, hold, sortie de stock, transaction ou paiement n'est créé.
9. Vérifier que les autres univers autorisés ne sont pas affectés par le verrouillage.

## Critère
PASS uniquement si l'accès et toutes les mutations sont bloqués côté serveur et qu'aucun effet métier n'est constaté. Une simple absence dans le menu est insuffisante.

État initial : NON EXÉCUTÉE ; blocage métier maintenu.
