# Assurance NAXA — parcours transactionnel et comptable

## Décisions métier

- Le référentiel des assureurs est partagé. Un Promoteur peut proposer un assureur ; le nom est normalisé pour empêcher les doublons actifs. La création d'un assureur ne crée jamais automatiquement une convention pharmacie.
- Chaque pharmacie déclare sa convention et ses règles : taux, périmètre global/catégorie/produit, plafond, franchise, exclusions, justificatifs et dates.
- Le client peut déclarer une couverture depuis le reçu de réservation. Cette déclaration reste non vérifiée jusqu'au contrôle de la carte et des justificatifs par la pharmacie.
- Le devis est calculé côté PostgreSQL depuis le prix stocké dans la réservation et les règles actives de la convention pharmacie. Le client ne peut pas imposer son taux ou son plafond : il déclare son identité d'assuré ; la pharmacie fixe taux, plafonds, franchises et exclusions.
- Un snapshot immuable fige les montants bruts, part assureur, part client et versions de règles. Une nouvelle négociation nécessite une nouvelle réservation ; un ancien devis n'est pas réécrit.
- Le client doit accepter le devis avant soumission. La pharmacie doit contrôler les justificatifs avant confirmation de prise en charge.
- Un refus de l'assureur n'est jamais présenté comme un remboursement.
- Une prise en charge confirmée crée une créance assureur. Seul un règlement effectivement reçu, sa date et sa référence diminuent cette créance. Les règlements partiels restent possibles, sans dépasser le solde dû.
- Les événements sont conservés dans un journal dédié, horodaté et en lecture seule pour les utilisateurs applicatifs.
- Le Promoteur voit uniquement les pharmacies de son réseau ; les postes pharmacie voient uniquement leur périmètre RLS. Le client ne voit que son propre snapshot et ses événements de réservation.
- L'Admin NAXA n'intervient pas dans le parcours métier Assurance.

## Contrat comptable

La vente Assurance conserve le total brut. Le paiement réellement reçu du client et la part assureur sont deux lignes de règlement distinctes : la vente comptabilise uniquement la part client ; la prise en charge confirmée crée la créance assureur à la vente finalisée ; le remboursement réellement reçu réduit ensuite cette créance. Les événements assurance_prise_en_charge et assurance_remboursement_recu entrent dans la file comptable existante. Le worker conserve ses contrôles : période ouverte, journal validé, mapping débit/crédit unique et comptes validés. Il n'utilise aucun compte implicite.

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
- Ticket Caisse : montant brut, part assureur, part client, règlements reçus et solde de créance, lorsque le dossier est relié à la vente POS.
- POS fractionné : le total brut reste le montant de vente ; la caisse encaisse uniquement la part client et enregistre la part assureur comme règlement de tiers/ créance. La finalisation exige que les deux parts égalent le devis et que le dossier soit accepté après contrôle documentaire.

## Limites de validation à ne pas masquer

- Les migrations sont appliquées sur le projet Replay uniquement.
- Le test SQL structurel 202611120_assurance_comptabilite_contract.sql a été exécuté sur Replay avec succès.
- Aucun parcours E2E avec comptes client/pharmacie/Promoteur/Comptable n'a encore été exécuté.
- Le POS fractionné et les reçus sont raccordés dans le code et la migration Replay ; aucun test E2E réel de retrait Assurance n'a encore été exécuté.
- Le Replay consulté ne contient aucun mapping comptable Assurance ni mapping vente validé ; la preuve d'une écriture débit/crédit réellement postée n'est donc pas disponible.
- La recherche publique n'est pas encore raccordée au filtre Assurance.
- Le mécanisme de proposition d'un nouveau montant par la pharmacie et d'accord client en cas d'écart de droits reste à construire.
- La recette UI/build TypeScript, les scénarios de remboursement partiel/total et le parcours de modification du devis restent à exécuter.
- Aucune migration ni écriture sur Supabase Production ; aucun déploiement Vercel.
