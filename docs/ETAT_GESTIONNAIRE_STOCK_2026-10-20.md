# NAXA — Construction du parcours Gestionnaire de stock

Date : 20 octobre 2026  
Branche : `main`  
Déploiement : **non demandé, aucun déploiement lancé**.  
Exécution Supabase : **aucune migration appliquée à une base dans cette intervention**.  
Vérifications : **volontairement différées**, conformément à la demande de construire le parcours avant de lancer les contrôles.

## Socle existant réutilisé

- Les tables existantes `reservations`, `reservation_items`, `stocks`, `stocks_lots`, `notifications`, `fils_messages`, `messages_pharmacie`, `fournisseurs`, `commandes_fournisseurs`, `receptions_fournisseurs`, `inventaires` et `inventaire_lignes` sont conservées.
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
- Migration 195 : confirme une réservation via une RPC serveur qui vérifie l’état, l’expiration, le périmètre et la couverture des demandes actives par les lots non périmés/non bloqués lorsqu’ils existent.
- Page de détail client : affiche l’historique des transitions et le formulaire de message lié au dossier.
- Notifications : les alertes de statut/expiration pointent vers le détail client; les notifications de réservation pointent vers la file de traitement; les messages routent vers la boîte de réception correspondant au destinataire.

### Fournisseurs, lots et inventaires
- Migration 191 : ajoute les RPC d’emplacement pour le stock et les lots, avec vérification de périmètre et de rôle.
- Migration 192 : ajoute une réception fournisseur atomique, avec lot et péremption obligatoires, refus des lots déjà périmés, mise à jour des quantités, historique de réception et refus en cas d’incohérence stock/lots. Les réceptions répétées d’un même lot augmentent sa quantité sans créer de doublon.
- Migration 193 : ajoute les sessions de prise/fin de service du Gestionnaire de stock.
- Migration 194 : ajoute les RPC transactionnelles de démarrage, d’ajout de référence, de comptage et de clôture d’inventaire, le détail par lot, l’application des écarts et un journal d’ajustements consultable dans les rapports. Les mouvements externes ne sont pas encore bloqués pendant le comptage; l’écran avertit de suspendre les mouvements.
- Migration 197 : durcit les politiques RLS du répertoire fournisseur pour empêcher les comptes non ERP de créer ou modifier des fournisseurs.
- Migration 198 : réserve les écritures de réception et d’inventaire aux RPC contrôlées; restreint les commandes fournisseur aux rôles ERP autorisés et protège la transition brouillon → envoyée.
- Migration 199 : permet le blocage/déblocage des lots avec motif obligatoire et contrôle de rôle/périmètre.

## Fichiers de migration et tests SQL ajoutés

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
- Lint, typecheck, build, tests SQL : **non exécutés à ce stade**.
- Migrations Supabase : **non appliquées**.
- Déploiement : **non lancé**.
- Parcours déclaré vert : **non**; la demande actuelle est de terminer la construction avant les vérifications.
