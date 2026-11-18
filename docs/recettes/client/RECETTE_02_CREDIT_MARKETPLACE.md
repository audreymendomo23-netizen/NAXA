# Recette 02 — Crédit Marketplace (profil Client)

- Dépendance : Recette 09 validée sur ses critères P1.
- Replay uniquement ; aucun mouvement financier réel ni paiement NAXA.

## Cas bulk
1. Éligibilité, plafond, solde, disponible et limites visibles.
2. Demande : pharmacie, téléphone, date future, montant/produits si prévus, justificatif photo/PDF et validations.
3. Double clic, soumission répétée, pièce invalide, taille dépassée, réseau interrompu.
4. États en attente, approuvé, refusé, expiré et annulé ; actualisation et notification.
5. Refus Promoteur : aucune réservation, aucun hold et aucun débit de stock.
6. Approbation : vérifier autorisation Promoteur, plafond, pharmacie, stock et débit une seule fois.
7. Historique des demandes, décisions, opérations et remboursements enregistrés par la pharmacie.
8. Échéances, solde restant, disponibilité recalculée et cohérence des montants.
9. Remboursement : le Client consulte les opérations enregistrées ; il ne réalise pas de remboursement financier dans l'application.
10. Isolation entre Clients et entre pharmacies.

## Cas contradictoires
- Dépassement du plafond ; compte suspendu ; pharmacie suspendue ; décision par acteur non habilité ; demande dupliquée ; stock insuffisant entre demande et approbation ; approbation concurrente ; statut déjà terminal.
- Ne pas confondre crédit comptoir, crédit Marketplace et paiement marchand.
- Rejouer seulement les extensions non couvertes par les preuves crédit existantes ; ne pas invalider les PASS acquis.

## Preuves
UI Playwright pour chaque parcours visible, API/RPC/SQL pour invariants, état avant/après, idempotence et nettoyage Replay.

État initial : NON EXÉCUTÉE pour les extensions ; preuves historiques limitées conservées séparément.
