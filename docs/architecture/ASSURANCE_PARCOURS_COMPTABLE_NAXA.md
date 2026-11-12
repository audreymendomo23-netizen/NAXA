# Assurance NAXA — parcours transactionnel et comptable

## Décisions métier

- Le référentiel des assureurs est partagé. Un Promoteur peut proposer un assureur ; le nom est normalisé pour empêcher les doublons actifs. La création d'un assureur ne crée jamais automatiquement une convention pharmacie.
- Chaque pharmacie déclare sa convention et ses règles : taux, périmètre global/catégorie/produit, plafond, franchise, exclusions, justificatifs et dates.
- Le client peut déclarer une couverture depuis le reçu de réservation. Cette déclaration reste non vérifiée jusqu'au contrôle de la carte et des justificatifs par la pharmacie.
- Le devis est calculé côté PostgreSQL depuis le prix stocké dans la réservation, la couverture client active et les règles de la convention.
- Un snapshot immuable fige les montants bruts, part assureur, part client et versions de règles. Une nouvelle négociation nécessite une nouvelle réservation ; un ancien devis n'est pas réécrit.
- Le client doit accepter le devis avant soumission. La pharmacie doit contrôler les justificatifs avant confirmation de prise en charge.
- Un refus de l'assureur n'est jamais présenté comme un remboursement.
- Une prise en charge confirmée crée une créance assureur. Seul un règlement effectivement reçu, sa date et sa référence diminuent cette créance. Les règlements partiels restent possibles, sans dépasser le solde dû.
- Les événements sont conservés dans un journal dédié, horodaté et en lecture seule pour les utilisateurs applicatifs.
- Le Promoteur voit uniquement les pharmacies de son réseau ; les postes pharmacie voient uniquement leur périmètre RLS. Le client ne voit que son propre snapshot et ses événements de réservation.
- L'Admin NAXA n'intervient pas dans le parcours métier Assurance.

## Contrat comptable

Les événements assurance_prise_en_charge et assurance_remboursement_recu entrent dans la file comptable existante. Le worker conserve ses contrôles : période ouverte, journal validé, mapping débit/crédit unique et comptes validés. Il n'utilise aucun compte implicite.

Le plan comptable et les mappings doivent être configurés/validés par la pharmacie via le processus comptable existant avant qu'une écriture puisse être postée. En leur absence, l'événement reste en attente puis passe par la politique de retry du worker ; le tableau ne doit jamais annoncer une écriture comptable validée sans ligne dans le journal.

## RPC livrées

- assurance_ajouter_assureur
- assurance_enregistrer_convention
- assurance_enregistrer_regle
- assurance_calculer_devis
- assurance_valider_devis
- assurance_controler_documents
- assurance_confirmer_prise_en_charge
- assurance_refuser_prise_en_charge
- assurance_enregistrer_remboursement

## Restitutions livrées

- Tableau de bord /pharmacie/assurance : dossiers, créances, remboursements réellement reçus et journal d'événements.
- Accès depuis l'espace Promoteur, Caisse et Comptable.
- Reçu client : déclaration/choix de couverture, calcul du devis, acceptation par le client, montant brut, part assureur (créance, non encaissée), part client et état du contrôle des justificatifs.
- Ticket Caisse : montant brut, part assureur, part client, règlements reçus et solde de créance.

## Limites de validation à ne pas masquer

- Les migrations sont appliquées sur le projet Replay uniquement.
- Le test SQL structurel 202611120_assurance_comptabilite_contract.sql a été exécuté sur Replay avec succès.
- Aucun parcours E2E avec comptes client/pharmacie/Promoteur/Comptable n'a encore été exécuté.
- Le plan comptable Replay consulté ne contient aucun compte validé ; la preuve d'une écriture débit/crédit Assurance réellement postée n'est donc pas disponible.
- La recherche publique n'est pas encore raccordée au filtre Assurance.
- Le taux et le plafond déclarés par le client sont des données déclaratives : la pharmacie doit confirmer les droits réels et toute différence doit passer par un mécanisme de modification/accord client avant la finalisation. Ce mécanisme de modification est encore à construire.
- La recette UI/build TypeScript et les scénarios de remboursement partiel/total restent à exécuter.
- Aucune migration ni écriture sur Supabase Production ; aucun déploiement Vercel.
