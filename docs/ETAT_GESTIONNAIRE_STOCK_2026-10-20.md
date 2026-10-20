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
- Migration 188 : ajoute les emplacements facultatifs et le lien notification-réservation; déclenche une notification de dossier groupée après insertion.
- Migration 189 : journalise les transitions de statut, crée les notifications client et fournit une fonction idempotente de rappel à 30 minutes; une planification pg_cron est tentée uniquement si l’extension est disponible et accessible.
- Migration 190 : relie les messages à une réservation, ajoute une RPC sécurisée d’envoi et propage le lien aux réponses dans le fil.
- Page de détail client : affiche l’historique des transitions et le formulaire de message lié au dossier.
- Notifications : les alertes de statut/expiration pointent vers le détail client; les notifications de réservation de pharmacie pointent vers la file de traitement.

### Fournisseurs, lots et inventaires
- Migration 191 : ajoute les RPC d’emplacement pour le stock et les lots, avec vérification de périmètre et de rôle.
- Migration 192 : ajoute une réception fournisseur atomique, avec lot et péremption obligatoires, mise à jour des quantités, historique de réception et refus en cas d’incohérence stock/lots.
- Migration 193 : ajoute les sessions de prise/fin de service du Gestionnaire de stock.

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

## Points de prudence à conserver

- L’alerte de 30 minutes dépend d’un ordonnanceur réellement disponible. La migration contient la fonction idempotente et tente la planification via pg_cron si l’extension est disponible; tant que les migrations et la planification n’ont pas été exécutées, l’envoi effectif n’est pas prouvé.
- Les notifications et messages sont enregistrés dans l’application. La livraison push quand l’application est fermée dépend de l’infrastructure push générique déjà configurée; elle n’est pas déclarée validée ici.
- La réception fournisseur refuse les stocks préexistants non lotisés ou incohérents plutôt que de créer des lots avec une péremption inventée.
- Les données client dans la file stock sont minimisées à un identifiant court; le traitement est groupé par dossier, pas par produit.
- Les données de stock visibles restent un instantané d’écran; chaque mutation doit être revalidée par les RPC de la base.
- La file de réservation affiche les statuts actifs `en_attente` et `confirmee`; les dossiers terminés sont accessibles via l’historique/rapports et le détail client.

## État de livraison du code

- Code ajouté directement sur `main` : oui.
- Lint, typecheck, build, tests SQL : **non exécutés à ce stade**.
- Migrations Supabase : **non appliquées**.
- Déploiement : **non lancé**.
- Parcours déclaré vert : **non**; la demande actuelle est de terminer la construction avant les vérifications.
