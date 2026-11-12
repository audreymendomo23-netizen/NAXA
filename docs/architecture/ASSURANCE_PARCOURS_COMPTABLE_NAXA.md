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
- Le Replay ne contient aucun compte, mapping, paramètre ni période comptable configuré ; aucune écriture métier réelle n'a donc été postée. Le test positif ci-dessous utilise exclusivement des comptes synthétiques dans une transaction annulée.
- Le contrat SQL vérifie également que `compta_emettre_evenement_metier` exclut les lignes `ASSURANCE:%` du montant de vente encaissé et que la clôture de caisse ne retient que les paiements en espèces. Ces garde-fous structurels ne remplacent pas un test de rapprochement avec une vente réelle.
- La recherche publique n'est pas encore raccordée au filtre Assurance.
- Le mécanisme de proposition d'un nouveau montant par la pharmacie et d'accord client en cas d'écart de droits reste à construire.
- La recette UI/build TypeScript, les scénarios métier authentifiés de remboursement partiel/total et le parcours de modification du devis restent à exécuter.
- Aucune migration ni écriture sur Supabase Production ; aucun déploiement Vercel.


## Reprise du verrou comptable — 12 novembre 2026

- Dérive corrigée dans le dépôt : la migration `20261112154710_assurance_compta_worker_support.sql` versionne la fonction active du worker, qui accepte `assurance_prise_en_charge` et `assurance_remboursement_recu` ainsi que la contrepassation de vente. Elle a été appliquée uniquement sur Replay ; entrée d'historique observée : `20261112154710 / assurance_compta_worker_support`.
- Test positif ajouté : `supabase/tests/202611121_assurance_compta_worker_positive.sql`. Résultat Replay : `202611121_assurance_compta_worker_positive PASS`.
- Le test transactionnel a traité une prise en charge synthétique de 10 000 FCFA, puis deux remboursements synthétiques de 4 000 et 6 000 FCFA. Il a vérifié trois écritures équilibrées, le débit de trésorerie de 10 000 FCFA, le rapprochement de la créance (débit 10 000 / crédits cumulés 10 000) et l'idempotence de l'outbox. Le `ROLLBACK` final a supprimé toutes les fixtures : aucune donnée comptable n'a été conservée.
- Contrôle du parcours de paramétrage : `/pharmacie/comptable/referentiels` est strictement en lecture seule (assureurs, fournisseurs, commandes). Le tableau Promoteur affiche les périodes, événements et écritures en lecture seule. Aucune interface ni RPC de gestion du plan comptable, des mappings débit/crédit ou des journaux n'a été trouvée dans le dépôt/base.
- Le cahier Comptable a été actualisé : le Promoteur conserve le droit permanent de configuration/validation du plan et des mappings ; il peut déléguer ce droit au Comptable par pharmacie, puis le retirer sans supprimer la lecture. Cette délégation n'ouvre aucun droit sur les ventes, la caisse, les dépenses ou la trésorerie.
- État après test Replay : 0 compte, 0 mapping, 0 paramètre, 0 période, 0 événement en file et 0 écriture persistante. Le test valide le moteur sur fixtures, pas la comptabilité réelle d'une pharmacie.



## Gouvernance des droits comptables — 12 novembre 2026

- Migration Replay : `20261112162608 / compta_droits_ecriture_promoteur_comptable`. Fichier versionné : `supabase/migrations/20261112162608_compta_droits_ecriture_promoteur_comptable.sql`.
- Table `compta_droits_ecriture` : droit individuel par Comptable et pharmacie, refusé par défaut ; RLS activée et aucun accès direct accordé à `anon` ou `authenticated`.
- Le RBAC reconnaît `MANAGE_ACCOUNTING` au Promoteur dans les quatre architectures ; ce droit est permanent dans le périmètre du réseau validé.
- RPC Promoteur : `compta_promoteur_lister_comptables` et `compta_promoteur_configurer_ecriture`. Le partage/retrait vérifie le Promoteur actif, son périmètre, l'affectation active du Comptable et écrit une entrée dans le journal d'audit.
- Le retrait fait passer le Comptable en lecture seule : `compta_scope_autorise` ne dépend plus du droit d'écriture. Le contrôle d'écriture est séparé dans `compta_ecriture_autorisee` et dans `private.naxa_has_privilege`.
- UI ajoutée : `/pharmacie/promoteur/comptabilite/droits`, accessible depuis le contrôle comptable réseau. Elle expose le partage et le retrait individuels.
- Test SQL : `supabase/tests/202611121_compta_droits_ecriture_contract.sql` — résultat Replay : `PASS`.
- Limite : Replay ne contient actuellement aucun compte Promoteur ni Comptable (seul un profil Admin est présent). Le parcours RPC authentifié partage/retrait n'a donc pas encore été exercé avec deux comptes réels. L'interface de création/validation du plan et des mappings reste à construire ; le présent changement pose le contrôle d'accès et sa délégation, pas les écrans de saisie comptable.


## Plan comptable & mappings — module de configuration partagé (12 novembre 2026)

- Migration Replay : `20261112180000_compta_plan_mappings_management`, versionnée dans `supabase/migrations/20261112180000_compta_plan_mappings_management.sql`.
- Route partagée : `/pharmacie/comptabilite/plan`, accessible au Promoteur actif sur son réseau et au Comptable affecté à sa pharmacie.
- Le plan permet de créer et modifier les comptes encore en brouillon (code, libellé, classe 1 à 9), puis de valider chaque compte individuellement ou tout le plan en une action dédiée. Un compte déjà validé n'est pas modifiable par le formulaire de création.
- Les mappings enregistrent type d'événement, sens débit/crédit, compte de destination et dates de validité. Un mapping ne peut être créé qu'avec un compte déjà validé. La validation refuse les périodes qui chevauchent un mapping déjà validé pour le même événement et le même sens.
- Les RPC de lecture, écriture et validation sont isolées, avec `SECURITY DEFINER`, `search_path` vide, droits d'exécution réservés à `authenticated`, contrôle de périmètre et de `compta_ecriture_autorisee`. Chaque création et validation écrit dans le journal comptable d'audit.
- La lecture du plan reste disponible après retrait de la délégation au Comptable ; la création et validation restent masquées dans l'interface et refusées par la base. Le Promoteur conserve son autorité permanente dans le réseau.
- Test structurel Replay : `supabase/tests/202611121_compta_plan_mappings_contract.sql` — résultat : `202611121_compta_plan_mappings_contract PASS`.
- Limite de preuve : Replay n'a pas de comptes Promoteur/Comptable authentifiés affectés à une pharmacie. Les actions métier via JWT réels, le cycle complet création → validation → worker, et le rendu navigateur/build TypeScript restent à valider. Aucun compte, mapping ou journal métier n'a été ajouté comme fixture persistante.
- Le module ne prétend pas fournir une balance ou des états financiers complets. La validation de compte/mapping est un prérequis au worker, pas une preuve de clôture comptable ni de conformité réglementaire.

- Migration complémentaire Replay : `20261112170000_compta_plan_validation_globale.sql`, RPC `compta_plan_valider_plan` pour valider en une action tous les comptes encore en attente ; elle renvoie le nombre validé et journalise l'action.
- Les comptes et mappings ont RLS activée, politiques de lecture dédiées et aucun droit direct API d'écriture. Les RPC d'écriture/validation restent le seul chemin de mutation.
- Contrôle Replay complémentaire : la RPC de validation globale est présente, exécutable par `authenticated`, non exécutable par `anon`, et son garde d'autorisation/audit est vérifié. Aucun compte/mapping n'a été créé pendant ce contrôle.
