# Assurance NAXA — parcours transactionnel et comptable

## Décisions métier

- Le référentiel des assureurs est partagé. Un Promoteur peut proposer un assureur ; le nom est normalisé pour empêcher les doublons actifs. La création d'un assureur ne crée jamais automatiquement une convention pharmacie.
- Chaque pharmacie déclare sa convention et ses règles : taux, périmètre global/catégorie/produit, plafond, franchise, exclusions, justificatifs et dates.
- Le client peut déclarer sa couverture depuis le reçu de réservation. La déclaration ne prouve pas les droits : la pharmacie doit la rapprocher d'une liste reçue de l'assureur, importée et simulée dans son périmètre ; les justificatifs papier/numériques sont contrôlés séparément au retrait.
- Le devis est calculé côté PostgreSQL depuis le prix stocké dans la réservation et les règles actives de la convention pharmacie. Le client ne peut pas imposer son taux ou son plafond : il déclare son identité d'assuré ; la pharmacie fixe taux, plafonds, franchises et exclusions.
- Un snapshot initial immuable fige les montants bruts, le partage initial et les versions de règles. Si la pharmacie propose une réduction de la part assureur, une proposition versionnée est conservée séparément ; le partage opérationnel ne change qu'après réponse explicite du Client. Aucun montant initial du snapshot n'est réécrit.
- Le client doit accepter le devis initial avant soumission. Une proposition financière ultérieure attend un accord ou un refus explicite du même Client. La pharmacie doit contrôler les justificatifs conformes avant confirmation de prise en charge.
- Un refus de l'assureur n'est jamais présenté comme un remboursement.
- Une prise en charge confirmée crée une créance assureur. Seul un règlement effectivement reçu, sa date et sa référence diminuent cette créance. Les règlements partiels restent possibles, sans dépasser le solde dû.
- Les événements sont conservés dans un journal dédié, horodaté et en lecture seule pour les utilisateurs applicatifs.
- Le Promoteur voit uniquement les pharmacies de son réseau ; les postes pharmacie voient uniquement leur périmètre RLS. Le client ne voit que son propre snapshot et ses événements de réservation.
- L'Admin NAXA n'intervient pas dans le parcours métier Assurance.

## Contrat comptable

La vente Assurance conserve le total brut. Le paiement réellement reçu du client et la part assureur sont deux lignes de règlement distinctes : la vente comptabilise uniquement la part client ; la confirmation de prise en charge après accord client et contrôle documentaire crée l'événement de créance assureur ; le rattachement POS réutilise la même clé d'idempotence ; le remboursement réellement reçu réduit ensuite cette créance. Les événements assurance_prise_en_charge et assurance_remboursement_recu entrent dans la file comptable existante. Le worker conserve ses contrôles : période ouverte, journal validé, mapping débit/crédit unique et comptes validés. Il n'utilise aucun compte implicite.

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
- assurance_proposer_montant
- assurance_repondre_proposition_montant
- assurance_import_simuler
- assurance_import_simuler_mode
- assurance_import_appliquer

## Restitutions livrées

- Tableau de bord /pharmacie/assurance : conventions, règles, import CSV/XLS/XLSX des listes assureurs (simulation puis application), dossiers, contrôles documentaires, propositions versionnées, remboursements réellement reçus et journal d'événements.
- Accès depuis l'espace Promoteur, Caisse et Comptable.
- Reçu client : déclaration/choix de couverture, blocage du devis jusqu'à une vérification exacte de l'adhérent pour la pharmacie de la réservation, calcul du devis, acceptation initiale, puis acceptation/refus d'une proposition de nouveau partage, historique et détail des montants initial/opérationnel.
- Ticket Caisse : montant brut, part assureur, part client, règlements reçus et solde de créance, lorsque le dossier est relié à la vente POS.
- POS fractionné : le total brut reste le montant de vente ; la caisse encaisse uniquement la part client retenue après le dernier accord du Client et enregistre la part assureur comme créance. La finalisation bloque une proposition en attente et rapproche le dossier, le règlement et le ticket sur le dernier partage accepté.

## Limites de validation à ne pas masquer

- Les migrations sont appliquées sur le projet Replay uniquement.
- Le test SQL structurel 202611120_assurance_comptabilite_contract.sql a été exécuté sur Replay avec succès.
- Aucun parcours E2E avec comptes client/pharmacie/Promoteur/Comptable n'a encore été exécuté.
- Le POS fractionné et les reçus sont raccordés dans le code et la migration Replay ; aucun test E2E réel de retrait Assurance n'a encore été exécuté.
- Le Replay ne contient aucun compte, mapping, paramètre ni période comptable configuré ; aucune écriture métier réelle n'a donc été postée. Le test positif ci-dessous utilise exclusivement des comptes synthétiques dans une transaction annulée.
- Le contrat SQL vérifie également que `compta_emettre_evenement_metier` exclut les lignes `ASSURANCE:%` du montant de vente encaissé et que la clôture de caisse ne retient que les paiements en espèces. Ces garde-fous structurels ne remplacent pas un test de rapprochement avec une vente réelle.
- Le filtre Assurance est déjà raccordé à la recherche Marketplace `/resultats` via les projections publiques des assureurs et des conventions actives ; la recette HTTP/browser multi-pharmacies reste à exécuter.
- Le nouveau pipeline d'import et le flux de proposition versionnée sont livrés en code et appliqués sur Replay ; aucun vrai fichier d'assureur n'a encore été fourni pour une recette de données réelles.
- Le build TypeScript/UI et les scénarios métier authentifiés restent à confirmer sur le dernier commit. Aucun test navigateur avec rôles Client/Pharmacien/Caisse, aucun encaissement de réservation Assurance réel et aucun remboursement réel n'ont encore été prouvés.
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


## Configuration opérationnelle des journaux et périodes — 12 novembre 2026

- Replay : migrations `compta_journaux_periodes_configuration` et `compta_mapping_types_concurrency` appliquées.
- RPC sécurisées : `compta_config_lire`, `compta_config_enregistrer_journal`, `compta_config_valider_journal`, `compta_config_ouvrir_periode`. Les mutations exigent `compta_ecriture_autorisee` et ajoutent un événement à l'audit comptable.
- Les journaux sont stockés dans `compta_parametre` sous les clés `journal_code.<evenement>`; aucun code de journal par défaut n'est injecté. Leur validation refuse les périodes de validité qui se chevauchent.
- L'ouverture d'une période vérifie les dates, la pharmacie active, le droit comptable et l'absence de chevauchement, avec verrou transactionnel par pharmacie.
- Les mappings sont désormais limités aux événements traités par le worker qui utilisent effectivement des mappings : ventes encaissées, dépenses validées, prise en charge Assurance et remboursement Assurance reçu. L'annulation de vente utilise une contrepassation de l'écriture d'origine et son journal ; aucun mapping débit/crédit n'est requis.
- Les validations de mapping et de journal sont sérialisées par verrou transactionnel pour éviter deux validations concurrentes qui se chevauchent.
- Contrat SQL Replay : `202611121_compta_journaux_periodes_contract.sql` — PASS structurel. Aucune période, aucun journal et aucun mapping de démonstration n'a été persisté.
- Limites : aucun compte Promoteur/Comptable de test authentifié n'est disponible sur Replay pour exercer les RPC par JWT réel. Le traitement automatique est désormais planifié via pg_cron interne (voir section suivante) ; le premier cycle périodique reste à confirmer. Build navigateur/TypeScript encore à exécuter.


## Traitement automatique de la file comptable — 12 novembre 2026

- Replay : migration `compta_worker_pg_cron` appliquée. La fonction privée `private.compta_worker_traiter_lot(50)` réclame et traite la file via les RPC service-role existantes.
- Le job `naxa-compta-worker` est actif toutes les 5 minutes, exécuté sous le rôle PostgreSQL `postgres`. Il ne dépend pas d'un endpoint HTTP, d'une Edge Function ou d'un secret supplémentaire.
- La fonction interne est inaccessible à `anon`, `authenticated` et `service_role` ; seul `postgres` peut l'exécuter. Elle pose un claim service-role transactionnel puis appelle les RPC existantes, qui conservent les contrôles métier, les périodes, les mappings, les journaux et l'idempotence.
- Test de contrat `202611121_compta_worker_cron_contract.sql` : vérifie le job, sa fréquence, son propriétaire et les ACL. Test positif Assurance modifié pour passer par le worker planifié lui-même et traiter prise en charge 10 000 FCFA + remboursements 4 000 et 6 000 FCFA, avec rollback des fixtures.
- Replay : appel manuel du worker à vide retournant `ok=true, reclames=0, traite=0, erreurs=0`. Premier cycle périodique confirmé dans `cron.job_run_details` le 12 novembre à 18:40:00 UTC : `succeeded`, durée 12 ms. La file ne contenait aucun événement métier persistant.
- Aucun compte, mapping, journal, période, événement ou écriture de démonstration n'est conservé.


## Blocage qualité global au checkpoint ec817c5

- Le workflow GitHub Actions échoue avant TypeScript et Next.js sur un test hors comptabilité : `scripts/test-suivi-interoperabilite.cjs` attend 30 types de mesure alors que le composant en expose 39 (`39 !== 30`). 161 tests passent et 1 échoue.
- Le build TypeScript/Next.js n'a donc pas été exécuté ; aucune conclusion de compilation n'est revendiquée pour le module comptable.
- Le statut CircleCI `ci/circleci: quality` reste `pending`.
- Ce blocage Bluetooth/suivi est distinct du chantier comptable et n'a pas été modifié dans cette intervention.

## Configuration détaillée des conventions — 12 novembre 2026

- L'interface `/pharmacie/assurance` permet désormais de saisir la référence et les dates de validité de la convention, puis de sélectionner une convention existante pour gérer ses règles.
- Les règles sont configurables par portée globale, catégorie ou produit ; le moteur applique la priorité produit > catégorie > globale.
- Chaque règle accepte son taux, son plafond par ligne, sa franchise, ses exclusions, les justificatifs requis et ses propres dates de validité.
- L'enregistrement passe par la RPC atomique `assurance_configurer_convention` pour la convention et la règle globale initiale, puis par `assurance_enregistrer_regle` pour les règles affinées. Une nouvelle version désactive l'ancienne règle de même portée sans modifier les snapshots de devis déjà figés.
- Le sélecteur produit n'expose que les produits dont la fiche catalogue est validée (`fiche_validee=true`). Sur Replay au contrôle, 20 produits de démonstration sont présents mais 0 fiche est validée ; aucun produit de test n'est donc proposé pour configurer une règle produit.
- Contrôle Replay : `assurance_enregistrer_regle` est exécutable par `authenticated`, non exécutable par `anon`; RLS est active sur `assurance_regles_convention`, avec lecture filtrée par le périmètre pharmacie. Les mutations directes restent interdites et passent par la RPC qui vérifie le poste actif et le périmètre.
- Le test structurel Assurance est complété pour vérifier ces garde-fous. La validation par JWT réel reste à faire : Replay ne dispose toujours pas de comptes Promoteur/Pharmacien affectés permettant de tester l'enregistrement des règles dans l'interface.
- Aucun changement de schéma ni migration supplémentaire n'a été nécessaire : les tables et RPC de règles existaient déjà sur Replay. Aucun changement Production ni déploiement.


## Contrôle ciblé des règles et des événements comptables — 12 novembre 2026

- Priorité du calcul : règle produit, puis catégorie (comparaison insensible à la casse), puis règle globale.
- Calcul par ligne : taux conventionnel, plafond par ligne, franchise, puis plafond restant de la couverture.
- Une exclusion produit/catégorie met la ligne à zéro avant toute consommation du plafond global ; les exclusions de catégorie sont comparées sans tenir compte de la casse.
- Le devis crée un snapshot et un dossier brouillon, mais aucun événement comptable.
- La confirmation pharmacie, après accord client et contrôle documentaire conforme, crée l'événement idempotent `assurance_prise_en_charge` (créance assureur).
- Seul l'enregistrement d'un remboursement réellement reçu crée `assurance_remboursement_recu`; le remboursement partiel ne solde pas la créance.
- Migration Replay : `20261112191000_assurance_exclusion_consumption_guard` et `20261112192000_assurance_confirmation_creance_comptable`.
- Test ciblé : `supabase/tests/202611121_assurance_rule_precedence_calculation.sql` — contrat de priorité, calcul, exclusions/plafond et frontières comptables. Exécuté sur Replay avec succès.
- Limite : ce test est un contrat SQL/structurel et un calcul de cas synthétiques ; il ne remplace pas un parcours E2E authentifié avec un vrai client, une pharmacie, une convention et un règlement.


## Clôture opérationnelle du parcours Marketplace Assurance — 15 novembre 2026

### Corrections versionnées sur `main`

- `8dc029c25617cb1c61f68455c732c34cde438d21` : la page Caisse ne consulte plus directement le registre privé `couvertures_assurance`. Elle affiche les snapshots financiers accessibles à la pharmacie, et charge les dossiers par `pharmacie_id` sans filtre erroné sur le créateur du dossier. Les données personnelles de couverture ne sont donc pas exposées à la Caisse.
- `368235024af9ffa1af6b5d1382e0d4e2e6ade3f0` : le tableau Assurance charge les snapshots et ajoute les actions de contrôle documentaire, de confirmation de prise en charge et d'enregistrement d'un remboursement réel. Les RPC gardent la décision finale : accord client, justificatifs conformes, statut du dossier, montant restant, date non future et référence obligatoire.
- `131b3a125054a8c3a0c96d24399aedb901d53632` : migration additive `caisse_annulation_propre_vente_guard`, appliquée sur Replay uniquement, qui limite une demande d'annulation à la vente créée par le compte demandeur.
- Les tests contractuels ont été alignés aux fonctions effectivement déployées : créance créée à la confirmation, même clé d'idempotence au rattachement POS, et taux appliqué issu de la règle pharmacie alors que la couverture déclarative du client est forcée à 100 %.

### Tests SQL exécutés sur Replay

- `supabase/tests/202611120_assurance_comptabilite_contract.sql` : terminé sans exception (transaction annulée).
- `supabase/tests/202611121_assurance_rule_precedence_calculation.sql` : `ASSURANCE_ACCOUNTING_EVENT_BOUNDARIES PASS`.
- `supabase/tests/202611121_assurance_compta_worker_positive.sql` : `202611121_assurance_compta_worker_positive PASS`. Fixtures synthétiques, prise en charge 10 000 FCFA, remboursements 4 000 + 6 000 FCFA, écritures équilibrées et idempotence ; `ROLLBACK` final.
- `supabase/tests/187_caisse_parcours_scope_assurances.sql` : `187_caisse_parcours_scope_assurances PASS` (RLS snapshots/dossiers, confidentialité des couvertures, demande d'annulation limitée à sa vente).
- `supabase/tests/20261114073630_marketplace_assurance_public_projection_acl.sql` : terminé sans exception ; les contrôles d'ACL/projections sont validés, avec 0 convention active exposée car Replay ne contient aucune convention.
- `supabase/tests/049_assurances.sql` : `049_assurances PASS`.

### Limites restantes — pas AU VERT

- Aucune importation de liste d'assurés transmise par assureur n'existe. Le format source, les clés fiables de rapprochement adhérent/bénéficiaire, l'identité de l'émetteur, la version et la date d'effet doivent être contractés avant d'importer des données personnelles. Aucune fausse liste ni correspondance approximative n'a été créée.
- Le mécanisme de proposition d'un nouveau montant par la pharmacie et de nouvel accord du client n'existe pas. Le snapshot actuel reste immuable ; la mise en place doit préserver cette immutabilité et créer une nouvelle version de négociation traçable.
- Aucun compte Client/Pharmacien/Caisse/Comptable affecté n'a réalisé une réservation, une vérification de droits, un contrôle documentaire, un encaissement POS ou un remboursement de bout en bout.
- Replay conserve 5 assureurs, mais 0 couverture, 0 convention, 0 règle, 0 snapshot, 0 dossier, 0 événement Assurance, 0 règlement, 0 période comptable, 0 événement comptable et 0 écriture persistante.
- Le test positif du worker valide un jeu synthétique rollbacké ; il ne prouve pas une comptabilité réelle ni le rapprochement d'une vente réelle.
- Le workflow GitHub qualité doit terminer avec Node/TypeScript/lint/build ; aucun résultat complet n'est encore retenu comme preuve dans cette clôture.

**État : PARTIEL — PAS AU VERT.** Les contrats SQL et les corrections de code sont avancés et testés sur Replay, mais le chargement assuré, la négociation d'écart, les comptes métier authentifiés et le parcours réel complet restent bloquants. Production et Vercel inchangés.


## Complément de clôture — import des assurés et négociation versionnée (15 novembre 2026)

### Import contrôlé des listes assureurs

- `supabase/migrations/20261115120000_assurance_import_membership_pos_negotiation.sql` : tables d'import et de lignes, simulation, empreinte SHA-256, détection des doublons, des correspondances nulles ou ambiguës, statuts actifs/suspendus/expirés, vérification de l'adhésion exigée avant calcul du devis.
- `supabase/migrations/20261115121500_assurance_multipharmacy_coverage_verification.sql` : historique de vérification indépendant par couple couverture/pharmacie ; mode `complet` remplaçant les vérifications antérieures de l'assureur pour cette pharmacie ; mode `delta` ne touchant que les lignes reçues ; toute correction des identifiants de couverture client invalide la vérification antérieure via `declaration_maj_at`.
- Interface `/pharmacie/assurance` : import CSV/XLS/XLSX, 10 Mo maximum, 5 000 lignes maximum, colonnes canoniques numéro adhérent/date début/statut et alias courants ; simulation obligatoire avant application. Une ligne non unique, invalide, répétée ou sans correspondance ne vérifie aucune couverture.
- Aucun compte client n'est créé par l'import. Les fichiers sont rattachés à l'assureur, à la pharmacie, à une référence de transmission et à une empreinte. L'empreinte atteste l'intégrité du fichier traité, pas l'identité cryptographique de l'émetteur ; la provenance reste attestée par l'opérateur qui reçoit le document.
- Le reçu Client ne permet plus le calcul du devis tant que la dernière vérification de cette couverture, dans cette pharmacie, est valide et correspond à la version actuelle de la déclaration.

### Négociation de montant et POS

- `assurance_montant_propositions` conserve chaque version, le motif, les deux parts et la réponse du Client. La proposition autorise seulement une réduction ou suppression de la part assureur initialement calculée ; le montant brut et le snapshot initial restent immuables.
- La pharmacie peut proposer depuis `/pharmacie/assurance` ; seul le Client propriétaire peut accepter ou refuser depuis le reçu de réservation.
- Une proposition en attente bloque la confirmation finale et l'encaissement. Après accord, le dossier, le POS fractionné, l'événement comptable et le ticket utilisent le dernier partage accepté ; la créance reste distincte de tout encaissement reçu.

### Preuves Replay et limites

- Tests exécutés sur Replay : `20261115101000_assurance_amount_proposal_workflow.sql` **PASS** ; `20261115121500_assurance_import_membership_pos_negotiation.sql` **PASS** ; `202611121_assurance_rule_precedence_calculation.sql` **PASS** après alignement du test d'idempotence sur la clé composite pharmacie ; `202611121_assurance_compta_worker_positive.sql` **PASS** ; `187_caisse_parcours_scope_assurances.sql` **PASS** ; contrats comptables et projections Marketplace exécutés sans exception.
- Test Node ajouté : `scripts/test-assurance-import-membership.cjs`, inclus dans `npm test` via `scripts/test-*.cjs`.
- État Replay après tests : 5 assureurs, 4 profils Client, 1 Promoteur, 1 Admin et 9 pharmacies toutes marquées démo ; 0 import, 0 couverture, 0 convention, 0 règle, 0 snapshot, 0 dossier, 0 vérification, 0 proposition et 0 règlement. Comptabilité : 0 plan, 0 mapping, 0 paramètre, 0 période, 0 événement, 0 écriture et 0 ligne.
- Aucun fichier assureur réel n'a été fourni ; l'import n'a donc pas été exécuté sur une liste réelle. Aucun rôle Pharmacien, Caisse ou Comptable n'est présent dans les profils Replay contrôlés et aucune pharmacie non-démo n'est disponible. L'E2E de bout en bout reste non prouvé.
- Le moteur comptable a passé le test transactionnel synthétique avec rollback, mais une écriture réelle n'est pas possible sans plan, mappings, paramètres et période configurés. Aucune configuration de test n'a été inventée.
- Aucun changement Production ni déploiement Vercel.

**État : PARTIEL — PAS AU VERT.** Les blocages d'implémentation de l'import et de la négociation sont levés côté code/Replay et les contrats structurels passent. Les preuves réelles de réception des listes, E2E métier et comptabilité restent à obtenir.


## Raccord final POS fractionné et reçu Client — 15 novembre 2026

### Défauts corrigés

- Le garde de changement de statut de réservation exigeait une ligne de règlement POS égale au brut. Il vérifie maintenant la somme des lignes Client + Assurance et exige qu'elle corresponde au total de la vente.
- Le snapshot de ticket sélectionne désormais le paiement réellement reçu du Client, exclut les lignes `ASSURANCE:%`, et gère une couverture à 100 % sans afficher la créance comme un encaissement.
- L'import reconnaît l'en-tête canonique `beneficiaire_nom`. Le modèle téléchargeable ne contient que des valeurs d'exemple fictives ; le guide est dans `docs/architecture/ASSURANCE_IMPORT_FORMAT_NAXA.md`.

### Migrations Replay

- `20261115134500_allow_split_pos_payments_for_reservations`
- `20261115140000_fix_reservation_receipt_snapshot_split_payments`

### Runtime transactionnel Replay

Le test `supabase/tests/20261115130000_assurance_marketplace_pos_ticket_reimbursement_runtime.sql` est **PASS**. Il traverse les RPC Client/Responsable/Caisse, le tiers payant, la négociation versionnée, le POS, le ticket, les remboursements partiel/total et l'outbox comptable. Partage final vérifié : 10 000 FCFA brut, 5 500 FCFA assureur, 4 500 FCFA Client ; 5 000 FCFA remis en espèces, 500 FCFA de monnaie ; remboursements 2 000 + 3 500 FCFA.

Toutes les données sont dans une transaction annulée. Après rollback : aucun stock/coût test, réservation, vente, ticket, import, couverture, dossier, règlement, écriture ou ligne comptable ne persiste. Le compte Caisse retrouve son rôle initial. La recette se déroule dans une pharmacie de démonstration visible : elle prouve l'intégration backend sous JWT, pas une recette navigateur ou une vente commerciale réelle.

### Blocages externes restants

- Aucun export réel d'assureur expurgé n'a été reçu : l'alias et le modèle CSV sont en place, mais le format propriétaire doit encore être confirmé à partir d'un fichier reçu par un opérateur habilité. SHA-256 n'authentifie pas l'émetteur.
- Aucun plan comptable, mapping, journal ou période n'est configuré sur Replay. Le test worker synthétique PASS ne valide pas une écriture comptable réelle. La pharmacie/son Promoteur ou Comptable doit fournir/valider le plan et les mappings selon le cahier Comptable.
- Le test runtime est une preuve backend SQL/RPC avec rollback ; le parcours navigateur réel des espaces Client, Assurance et Caisse reste à exécuter sur une pharmacie autorisée.

**État : PARTIEL — PAS AU VERT GLOBAL.** Le chemin backend Marketplace → Assurance → POS → reçu → règlements est démontré sur Replay ; l'import assureur réel, la recette navigateur et la configuration comptable de la pharmacie restent ouverts. Production et Vercel inchangés.


## Vérification finale intégrée — import, négociation, POS et grand livre Replay (15 novembre 2026)

### Composants effectivement livrés

- Import professionnel CSV/XLS/XLSX : limite 10 Mo/5 000 lignes, normalisation d'en-têtes et dates, SHA-256, référence source, simulation obligatoire, contrôle du doublon fichier, des adhérents sans correspondance, ambigus, doublons et invalides. L'application d'une liste complète ou d'un delta crée des états de vérification versionnés par pharmacie. Une modification de déclaration client invalide la vérification antérieure. Le modèle fictif est `public/modeles/assureur-liste-assures-exemple.csv`.
- Vérification de couverture : le devis n'est calculable que si le rapprochement assureur le plus récent est positif pour la couverture et la pharmacie de la réservation ; une suspension/expiration ou une correction de la déclaration bloque l'ancien état.
- Négociation versionnée : `assurance_montant_propositions` conserve chaque offre, motif et réponse. La pharmacie ne peut que diminuer la part assureur initialement proposée. Le snapshot initial (montant brut, calcul de départ, items et règles) n'est jamais réécrit. Seul le Client propriétaire, en rôle Client actif, peut accepter/refuser ; une proposition non répondue bloque la confirmation définitive.
- POS et reçu : le dernier partage accepté est repris pour les lignes Client/Assurance. Le reçu Client exclut les lignes `ASSURANCE:%` des montants réellement reçus et restitue le partage initial et le partage négocié.
- Comptabilité : l'outbox émet la créance, les remboursements reçus et la vente encaissée (uniquement la part Client). Le worker traite désormais les événements dans la recette intégrée, avec mappings et période provisoires annulés à la fin.

### Tests Replay exécutés

- `20261115121500_assurance_import_membership_negotiation.sql` — **PASS** : tables, RLS, droits RPC, confidentialité des imports et contrôles de vérification.
- `20261115123000_assurance_import_runtime_multipharmacy.sql` — **8 contrôles PASS** : mode complet, delta, suspension, réactivation, correction de déclaration, vérification limitée à la pharmacie et rejet des devis hors pharmacie.
- `20261115101000_assurance_amount_proposal_workflow.sql` — **PASS** : versionnage, rôle et périmètre professionnel, accord/refus explicite Client, immutabilité du snapshot et blocage de confirmation.
- `20261115103000_assurance_client_refusal_event_visibility.sql` — **PASS**.
- `20261115104000_assurance_accounting_event_idempotence_scope.sql` — **PASS**.
- `20261115130000_assurance_marketplace_pos_ticket_reimbursement_runtime.sql` — **PASS**, réexécuté après extension au worker comptable.

### Résultat chiffré du runtime intégré

| Étape | Preuve |
|---|---:|
| Réservation brute Marketplace | 10 000 FCFA |
| Part assureur initiale / Client initiale | 6 000 / 4 000 FCFA |
| Proposition pharmacie puis nouvel accord Client | 5 500 / 4 500 FCFA |
| Espèces remises / monnaie rendue | 5 000 / 500 FCFA |
| Remboursements assureur partiel + solde | 2 000 + 3 500 FCFA |
| Événements traités par le worker | 4 : créance, 2 règlements, vente Client |
| Écritures générées | 4, toutes à 2 lignes équilibrées |
| Grand livre : créance assureur | Débit 5 500 / crédit 5 500 FCFA |
| Grand livre : espèces Client | Débit 4 500 FCFA |
| Grand livre : revenu cumulé Client + Assurance | Crédit 10 000 FCFA |

Le test réutilise une identité Client et un compte Caisse Replay existants. Le rôle Responsable est temporairement ajouté au même compte professionnel pour la recette, activé puis quitté via la RPC officielle de sélection de rôle. Le plan comptable (4 comptes), les 6 mappings, les 3 journaux, la période, les réservations, ventes, règlements, vérifications, propositions, écritures et lignes sont tous créés dans une transaction de test puis annulés par `ROLLBACK`.

### Nettoyage confirmé après runtime

- Rôle du compte professionnel : `caisse` restauré.
- Affectation Responsable temporaire de recette : absente.
- Réservation de recette, vente de recette, événements en attente : 0.
- Import, lignes d'import, vérifications, couvertures, conventions, snapshots, dossiers, propositions et règlements : 0 persistant.
- Périodes, comptes, mappings, paramètres, événements comptables, écritures et lignes : 0 persistant.
- Stock/coût de test et lots du produit de recette : 0 fixture persistante.

### Limites réelles qui restent ouvertes

1. Aucun export provenant d'un assureur n'a été fourni. Le modèle et les alias canoniques sont prêts, mais le format propriétaire doit être confirmé sur un exemple expurgé reçu par un opérateur autorisé. Le SHA-256 atteste l'intégrité du fichier, pas l'identité de son émetteur.
2. Le runtime est une preuve backend PostgreSQL/RPC sous JWT de recette dans une pharmacie de démonstration visible ; il ne vaut pas validation navigateur de tous les écrans ni vente commerciale dans une pharmacie non-démo autorisée.
3. Les écritures ont été effectivement générées et contrôlées par le worker, mais uniquement avec un plan, des mappings, journaux et une période temporaires de test rollbackés. La comptabilité persistante d'une pharmacie exige les comptes, journaux, mappings et période fournis/validés par son responsable comptable. Aucun compte normalisé ou OHADA n'a été inventé.
4. **CI GitHub Actions qualité : PASS** sur `86ac0c92e2a0b61857059fb08dc9f16c0a1f43e3` (run [43725341495](https://github.com/audreymendomo23-netizen/NAXA/actions/runs/43725341495)) : 504 tests PASS / 0 FAIL / 0 SKIP, TypeScript, ESLint, build Next.js Node 22 et `actionlint`. Le run E2E Replay strict `43725341532` est en cours ; le check Supabase Preview reste distinct et annulé par la limite mensuelle des push events.

**État de clôture : PARTIEL — PAS AU VERT GLOBAL.** Les défauts d'implémentation import, négociation, POS, ticket et intégration comptable runtime sont corrigés et testés sur Replay. Les seuls blocages restants sont la validation sur un vrai fichier d'assureur, la recette navigateur avec les utilisateurs et la pharmacie autorisés, la configuration comptable réelle de cette pharmacie ; la CI applicative sur `86ac0c9` est désormais PASS, avec 504 tests réussis et `actionlint` PASS. Le workflow Replay à secrets stricts reste en cours. Production et Vercel inchangés.
