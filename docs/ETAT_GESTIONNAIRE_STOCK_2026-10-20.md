# NAXA — État du premier incrément Gestionnaire de stock

Date : 20 octobre 2026  
Branche : `main`  
Périmètre : file de travail groupée par réservation Marketplace, information de stock/lot et annulation via RPC existante. Aucun déploiement ni aucune migration Supabase n'a été exécuté.

## Audit préalable

- La branche `main` auditée avant modification était `0baa2cf03f55a043c5d9037f0305ba148220c9a8`.
- Le dépôt possède déjà `public.reservations`, `public.reservation_items`, `public.stocks`, `public.stocks_lots` et `public.notifications`.
- Les réservations Pharmacie utilisent des statuts `en_attente`, `confirmee`, `payee`, `retiree`, `expiree`, `annulee`.
- La migration 161 documente que le stock d'une réservation est déjà réservé et que l'encaissement POS ne doit pas débiter le stock une seconde fois.
- La migration 163 expose `public.set_reservation_status`; l'annulation doit réutiliser cette RPC afin de garder les contrôles de transition et la restitution du stock.
- `stocks_lots` possède les numéros de lot, péremptions, quantités et blocages, mais le schéma inspecté ne contenait pas de localisation physique.
- La messagerie existante utilise les fils client–pharmacie et les RPC `envoyer_message_client` / `repondre_message`. La liaison conversation-réservation n'est pas démontrée par le schéma audité.
- Le dépôt ne contenait pas de route identifiée `/pharmacie/gestionnaire-stock` avant cet incrément.

## Changements commis directement sur main

- `supabase/migration_188_stock_manager_reservation_notification.sql`
  - ajoute les colonnes facultatives d'emplacement à `stocks` et `stocks_lots` ;
  - ajoute `notifications.reservation_id` et une unicité pour empêcher les notifications initiales en double ;
  - crée une notification groupée par dossier, avec les lignes de produits, le stock agrégé, les lots non bloqués/non périmés et leurs emplacements ;
  - utilise un déclencheur différé pour lire les lignes de réservation insérées dans la même transaction ;
  - n'invente aucune localisation absente.
- `supabase/tests/188_stock_manager_reservation_notification.sql`
  - ajoute un test SQL structurel du contrat de migration.
- `src/app/pharmacie/gestionnaire-stock/actions.ts`
  - annule via la RPC existante `set_reservation_status` et exige une confirmation explicite dans le formulaire.
- `src/app/pharmacie/gestionnaire-stock/page.tsx`
  - route d'entrée vers la file de réservations.
- `src/app/pharmacie/gestionnaire-stock/reservations/page.tsx`
  - première file de travail organisée par réservation, avec détail des lignes, stock/lots/emplacements et action d'annulation.
- `src/lib/messagerie.ts` et `src/app/notifications/page.tsx`
  - exposent le lien vers le dossier de réservation dans les notifications.

## Limites à résoudre avant de déclarer l'incrément complet

1. La migration 188 est un fichier de dépôt uniquement : elle n'a pas été appliquée à une base Supabase.
2. Le test SQL 188 a été ajouté mais n'a pas été exécuté faute d'accès à un runner PostgreSQL/Supabase dans cette intervention.
3. Lint, typecheck et build n'ont pas été exécutés ; la compilation n'est donc pas déclarée verte.
4. La route affiche un identifiant client court plutôt que des données personnelles, en attendant de confirmer les politiques RLS de lecture des profils.
5. Les emplacements doivent être renseignés dans les données de stock/lot par une opération autorisée ; ils ne peuvent pas être déduits automatiquement.
6. L'alerte 30 minutes avant expiration avec planification serveur et livraison application fermée reste à raccorder ; cet incrément affiche l'échéance et les réservations urgentes mais ne prétend pas envoyer cette alerte.
7. La boîte de réception n'est pas encore filtrée spécifiquement au rôle Gestionnaire de stock et les conversations ne sont pas encore rattachées à une réservation.
8. La navigation complète à neuf entrées, le traitement des anomalies, les événements d'historique client et les tests bout-en-bout restent à construire.

## État

- **Code ajouté sur main : oui.**
- **Tests exécutés : aucun.**
- **Migration exécutée : non.**
- **Déploiement : non.**
- **Parcours complet à 360° : non démontré.**

Ne pas appliquer la migration à Production sans revue et autorisation distinctes. Continuer par la revue de la migration et la vérification de compilation, puis raccorder les notifications et transitions aux parcours client et caisse.
