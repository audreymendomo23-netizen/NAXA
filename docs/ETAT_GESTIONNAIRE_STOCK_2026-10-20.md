# NAXA — Construction du parcours Gestionnaire de stock

Date : 20 octobre 2026  
Branche : `main`  
Déploiement : **non demandé, aucun déploiement lancé**.  
Exécution Supabase : **aucune migration appliquée à une base dans cette intervention**.  
Vérifications : **volontairement différées**, conformément à la demande de construire le parcours avant de lancer les contrôles.

## Socle existant réutilisé

### Constat du schéma NAXA (lecture seule, 21 octobre 2026)
- Le projet Supabase Naxa actif a été inspecté sans écriture : `my_pharmacies()` retourne un ensemble d’UUID, pas des objets; les écrans ont été corrigés pour utiliser ce contrat et charger les noms séparément.
- Le schéma actif possède déjà `naxa_scope_allows(uuid,uuid,text)` et `naxa_has_privilege(text,uuid,text)`, mais pas `can_access_pharmacy`. Les nouvelles migrations et les migrations de lots concernées utilisent désormais le helper de périmètre réellement présent.
- La table `stocks_lots` active ne contenait que les colonnes historiques `lot/peremption` et n’avait pas d’identifiant `id` ni de colonnes canoniques. Les tables fournisseurs, réceptions et inventaires ne sont pas présentes dans le schéma actif. La migration fondation ci-dessous comble explicitement cet écart, sans inventer de numéros de lot ni de péremptions.
- La liste Supabase indique des migrations enregistrées jusqu’à la série 153; les migrations ERP 154+ du dépôt ne sont pas considérées comme exécutées par ce constat.

- Les tables déjà présentes dans la base inspectée sont `reservations`, `reservation_items`, `stocks`, `stocks_lots`, `notifications`, `fils_messages` et `messages_pharmacie`. Les tables `fournisseurs`, `commandes_fournisseurs`, `receptions_fournisseurs`, `inventaires` et `inventaire_lignes` doivent être créées par la migration de fondation; elles ne sont pas présentées comme déjà déployées.
- La réservation reste la source de vérité. L’annulation passe par `public.set_reservation_status`, qui contrôle les transitions et restitue le stock.
- La migration 161 indique que le stock d’une réservation est déjà réservé; l’encaissement POS ne doit donc pas le débiter une seconde fois.
- Le paiement et le retrait restent traités par le parcours de caisse existant. NAXA ne propose pas de livraison dans le parcours de réservation avec retrait.

## Parcours ajouté sur main

### Navigation et espaces
- Tableau de bord du Gestionnaire de stock.
- Stock & logistique : stock agrégé, alertes de stock bas et modification d’emplacement via RPC autorisée.
- Réservations Marketplace : un dossier par client/réservation, lignes produits, stock agrégé, lots bloqués/périmés, quantités utilisables, localisation connue ou explicitement non renseignée, échéance et annulation confirmée.
- Lots & péremptions : suivi des lots, péremptions, blocages, motifs et emplacements modifiables via RPC.
- Fournisseurs & réceptions : création fournisseur, création de commande, ajout de lignes, journal de réceptions et formulaire de réception réelle.
- Inventaires : création complet/ciblé, préparation de lignes, comptage, écarts et clôture via les RPC existantes.
- Historique & rapports : résumé des stocks/lots et dossiers Marketplace récents.
- Prise / fin de service : sessions horodatées, fermeture avec note et historique.
- Profil : accès au profil NAXA.
- Déconnexion reste une action distincte au bas du panneau latéral.

### Marketplace, client et messagerie
- Migration 188 : ajoute les emplacements facultatifs et le lien notification-réservation. La notification est créée/actualisée à partir des lignes produits, pour couvrir aussi une insertion des lignes dans un appel séparé; une seule notification est conservée par dossier. Les mises à jour de notification sont reçues en temps réel lorsque le client est connecté.
- Migration 189 : journalise les transitions de statut, crée les notifications client et fournit un rappel idempotent à 30 minutes avec index anti-doublon. La migration tente de planifier pg_cron si disponible; l’exécution réelle reste à confirmer.
- Migration 190 : relie les messages à une réservation, ajoute une RPC sécurisée d’envoi et propage le lien aux réponses dans le fil.
- Migration 195 introduit la RPC de confirmation; migration 201 la remplace par une vérification des allocations de lots réellement réservées, de l’état, de l’expiration et du périmètre, sans comparer une seconde fois la demande au stock déjà réservé.
- Page de détail client : affiche l’historique des transitions et le formulaire de message lié au dossier.
- Notifications : les alertes de statut/expiration pointent vers le détail client; les notifications de réservation pointent vers la file de traitement; les messages routent vers la boîte de réception correspondant au destinataire.

### Fondations et lots
- Migration 174-z : réconcilie les colonnes canoniques des lots avec le schéma historique, autorise les fonctions internes du Gestionnaire de stock et crée les tables fournisseurs, commandes, réceptions, inventaires et rappels de lots avec RLS de base.

### Fournisseurs, lots et inventaires
- Migration 191 : ajoute les RPC d’emplacement pour le stock et les lots, avec vérification de périmètre et de rôle.
- Migration 192 : ajoute une réception fournisseur atomique, avec lot et péremption obligatoires, refus des lots déjà périmés, mise à jour des quantités, historique de réception et refus en cas d’incohérence stock/lots. Les réceptions répétées d’un même lot augmentent sa quantité sans créer de doublon.
- Migration 193 : ajoute les sessions de prise/fin de service du Gestionnaire de stock.
- Migration 194 : ajoute les RPC transactionnelles de démarrage, d’ajout de référence, de comptage, de clôture et d’annulation d’inventaire, le détail par lot, l’application des écarts et un journal d’ajustements consultable dans les rapports. Migration 202 ajoute le verrou serveur des mouvements pendant le comptage; la clôture ferme le comptage dans la même transaction avant d’appliquer les écarts.
- Migration 197 : durcit les politiques RLS du répertoire fournisseur pour empêcher les comptes non ERP de créer ou modifier des fournisseurs.
- Migration 198 : réserve les écritures de réception et d’inventaire aux RPC contrôlées; restreint les commandes fournisseur aux rôles ERP autorisés et protège la transition brouillon → envoyée.
- Migration 199 : permet le blocage/déblocage des lots avec motif obligatoire et contrôle de rôle/périmètre.
- Migration 200 : allocations FEFO par dossier et restitution exacte des lots à l’annulation/expiration, avec préflight qui refuse toute réconciliation historique ambiguë. Le garde de lotisation empêche aussi de créer des lots si une réservation active antérieure n’a pas d’allocation traçable.
- Migration 201 : confirmation de réservation fondée sur les allocations réelles; évite de comparer deux fois la demande au stock déjà réservé.
- Migration 202 : verrou serveur des mouvements de stock pendant un inventaire ouvert; la clôture passe le dossier à l’état fermé dans la même transaction avant d’appliquer les écarts.
- Migration 203 : annulation d’un dossier de réservation contrôlée par rôle, périmètre pharmacie et transition métier atomique.
- Migration 204 : journal append-only des changements de stock agrégé et de lots, exposé en lecture seule dans Historique & rapports.
- Export CSV authentifié et limité au périmètre pharmacie pour mouvements, réservations et écarts d’inventaire.
- Migration 205 : initialisation contrôlée d’une référence catalogue à quantité zéro avec prix de vente explicite, avant réception réelle par lot.
- Migration 206 : mouvements contrôlés de perte, retour et ajustement avec motif obligatoire, variation de lot/stock atomique et journalisation.
- Migration 207 : transferts internes atomiques entre pharmacies autorisées, avec conservation du lot, contrôle de péremption et journal dédié.
- Migration 208 et route `/api/cron/reservation-expiry` : exécution du rappel à 30 minutes par un ordonnanceur serveur authentifié si `pg_cron` n’est pas disponible. La planification externe et les secrets d’environnement restent à configurer dans l’environnement de déploiement.
- L’interface de réservation affiche maintenant les lots affectés au dossier et bloque la confirmation côté écran si l’allocation n’est pas vérifiable.
- Le tableau de bord stock est distinct de la file des réservations; la boîte de messages choisit le périmètre pharmacie correspondant au dossier demandé.

## Fichiers de migration et tests SQL ajoutés

- `supabase/migration_174_z_gestionnaire_stock_foundation.sql`
- `supabase/tests/174_z_gestionnaire_stock_foundation.sql`
- `supabase/migration_188_stock_manager_reservation_notification.sql`
- `supabase/tests/188_stock_manager_reservation_notification.sql`
- `supabase/migration_189_reservation_history_expiry_alert.sql`
- `supabase/tests/189_reservation_history_expiry_alert.sql`
- `supabase/migration_190_reservation_linked_messaging.sql`
- `supabase/tests/190_reservation_linked_messaging.sql`
- `supabase/migration_191_stock_locations.sql`
- `supabase/tests/191_stock_locations.sql`
- `supabase/migration_192_fournisseur_reception_atomique.sql`
- `supabase/tests/192_fournisseur_reception_atomique.sql`
- `supabase/migration_193_gestionnaire_stock_service.sql`
- `supabase/tests/193_gestionnaire_stock_service.sql`
- `supabase/migration_194_gestionnaire_stock_inventaires_transactionnels.sql`
- `supabase/tests/194_gestionnaire_stock_inventaires_transactionnels.sql`
- `supabase/migration_195_gestionnaire_stock_reservation_confirmer.sql`
- `supabase/tests/195_gestionnaire_stock_reservation_confirmer.sql`
- `supabase/migration_197_fournisseurs_role_security.sql`
- `supabase/tests/197_fournisseurs_role_security.sql`
- `supabase/migration_198_stock_workflow_write_security.sql`
- `supabase/tests/198_stock_workflow_write_security.sql`
- `supabase/migration_199_stock_lot_blocking.sql`
- `supabase/tests/199_stock_lot_blocking.sql`
- `supabase/migration_200_reservation_lot_allocation_atomic.sql`
- `supabase/tests/200_reservation_lot_allocation_atomic.sql`
- `supabase/migration_201_stock_reservation_confirmation_allocation.sql`
- `supabase/tests/201_stock_reservation_confirmation_allocation.sql`
- `supabase/migration_202_inventory_lock_stock_movements.sql`
- `supabase/tests/202_inventory_lock_stock_movements.sql`
- `supabase/migration_203_stock_reservation_cancel_role_guard.sql`
- `supabase/tests/203_stock_reservation_cancel_role_guard.sql`
- `supabase/migration_204_stock_manager_movement_journal.sql`
- `supabase/tests/204_stock_manager_movement_journal.sql`
- `supabase/migration_205_stock_reference_initialiser.sql`
- `supabase/tests/205_stock_reference_initialiser.sql`
- `supabase/migration_206_stock_manager_controlled_adjustments.sql`
- `supabase/tests/206_stock_manager_controlled_adjustments.sql`
- `supabase/migration_207_stock_manager_transfers.sql`
- `supabase/tests/207_stock_manager_transfers.sql`
- `supabase/migration_208_reservation_expiry_scheduler_service_role.sql`
- `supabase/tests/208_reservation_expiry_scheduler_service_role.sql`
- `src/app/api/cron/reservation-expiry/route.ts`
- `src/app/pharmacie/gestionnaire-stock/historique-rapports/export/route.ts`

## Points de prudence à conserver

- L’alerte de 30 minutes dépend d’un ordonnanceur réellement disponible. La migration contient la fonction idempotente et tente la planification via pg_cron si l’extension est disponible; tant que les migrations et la planification n’ont pas été exécutées, l’envoi effectif n’est pas prouvé.
- Les notifications et messages sont enregistrés dans l’application. La livraison push quand l’application est fermée dépend de l’infrastructure push générique déjà configurée; elle n’est pas déclarée validée ici.
- La réception fournisseur refuse les stocks préexistants non lotisés ou incohérents plutôt que de créer des lots avec une péremption inventée.
- Les données client dans la file stock sont minimisées à un identifiant court; le traitement est groupé par dossier, pas par produit.
- Les données de stock visibles restent un instantané d’écran; chaque mutation doit être revalidée par les RPC de la base.
- Les tableaux Stock & logistique, Lots & péremptions et Réservations Marketplace sont paginés; les compteurs principaux utilisent des comptages exacts lorsque l’API les retourne.
- La commande fournisseur suit maintenant le cycle brouillon → marquée envoyée → réception partielle/complète; la réception est bloquée tant que la commande est encore en brouillon.
- La file de réservation affiche les statuts actifs `en_attente` et `confirmee`; les dossiers terminés sont accessibles via l’historique/rapports et le détail client.

## État de livraison du code

- Code ajouté directement sur `main` : oui.
- Lint, typecheck, build, tests SQL : **non exécutés** (pas de CI lancée).
- Migrations Supabase : **non appliquées**; l’audit SQL effectué était en lecture seule. La base active reste donc non alignée avec le nouveau parcours tant que la fondation et les migrations requises ne sont pas exécutées dans l’ordre.
- Déploiement : **non lancé**.
- Parcours déclaré vert : **non**; la demande actuelle est de terminer la construction avant les vérifications.
