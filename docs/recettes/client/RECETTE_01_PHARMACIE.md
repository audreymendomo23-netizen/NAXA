# Recette 01 — Univers Pharmacie (profil Client)

- Dépendance : Recette 09 validée sur ses critères P1.
- Environnement : Supabase Replay `pwfftcsjyeibxxqhwysw` uniquement.
- Ne pas rejouer les assertions déjà vertes du Lot B2 sans extension de couverture ou preuve contradictoire.

## Périmètre bulk
1. Fiche produit : informations, disponibilité, prix, pharmacie propriétaire, états absent/indisponible.
2. Pharmacies de garde : ville, planning, détail, appel, itinéraire et source du planning.
3. Alerte disponibilité : création, doublon, désactivation, réception et suppression.
4. Scanner : caméra, galerie, PDF, formats/poids, multi-pages, recadrage, OCR, résultat vide, échec et saisie manuelle.
5. Ordonnance sécurisée : destinataire, fichier, note, soumission, états pharmacien, URL signée, expiration et refus. Distinguer du scanner OCR local.
6. Panier : quantités, retrait de ligne, panier vide, groupes de pharmacies, stock insuffisant et articles sans propriétaire.
7. Checkout : retrait/livraison, GPS autorisé/refusé, devis routier, échec de devis, double clic et soumission répétée.
8. Paiement déclaré : espèces/MTN/Orange selon options autorisées, valeurs par défaut, correction, partage SMS volontaire, référence invalide, attente de vérification et confirmation.
9. Livraison : préparation, assignation, acceptation, états, position, retard, annulation, remise, confirmation de réception et reçu.
10. Historique : filtres, détails, justificatifs, isolation entre deux Clients.

## Cas négatifs et limites
- Stock nul/insuffisant, pharmacie suspendue, produit retiré, session expirée, réseau interrompu, permissions GPS/caméra refusées, fichier invalide, SMS absent ou ambigu, double soumission, transition de statut interdite.
- Le Client ne peut ni confirmer une préparation pharmacie, ni agir comme livreur.
- NAXA ne doit pas être présenté comme encaisseur : paiement auprès de la pharmacie/marchand.

## Preuves et verdict
Playwright UI + API/RPC/SQL ciblés + état DB avant/après + nettoyage Replay. Les preuves SQL seules ne valident pas l'interface. B2 reste acquis : recherche Marketplace, favoris, réservation simple, anti-survente, confirmation pharmacie, annulation, restitution stock et historique dans le périmètre exact.

État initial : NON EXÉCUTÉE pour les extensions listées.
