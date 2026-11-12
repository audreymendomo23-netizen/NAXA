# Audit — fraîcheur des stocks et quantités Marketplace Pharmacie

Date : 12 novembre 2026  
Périmètre : Marketplace Pharmacie, panier client, réservation/commande et stock ERP.  
Gouvernance : branche `main` uniquement ; aucun déploiement Production.

## État initial observé

- `public.marketplace_offre_stock_disponible(uuid, uuid)` calculait le stock vendable (lots, péremption et holds), mais ne rejetait pas un stock ancien de plus de 48 h.
- `private.reserve_stock(uuid, jsonb)`, appelée par `public.creer_transactions_client`, verrouillait les lignes de stock et vérifiait la quantité et le prix côté serveur, mais ne contrôlait pas la fraîcheur.
- `src/app/panier/page.tsx` avait déjà des contrôles `− / +`, plafonnés à 10 par défaut.
- Après sélection d'une pharmacie, `src/app/resultats/page.tsx` transférait les articles au panier sans conserver le prix et la quantité réellement disponibles de cette pharmacie.
- `src/app/commande/nouvelle/page.tsx` affichait la quantité sans permettre de la modifier et ne présentait pas de sous-total dynamique des médicaments.

## Décisions et règles appliquées

1. Le seuil est inclusif : un stock âgé de 48 h exactement reste admissible ; au-delà, il est exclu.
2. La fraîcheur repose sur un mouvement réel de quantité du journal `stock_manager_movement_journal` (`creation`, `quantite`, `suppression`). Une modification de prix ou de métadonnée ne renouvelle pas artificiellement le stock.
3. Pour les stocks historiques sans ligne de journal, `stocks.updated_at` sert de repli de compatibilité. Sans date exploitable, l'offre est masquée.
4. Les stocks lotisés utilisent les lots non bloqués et non périmés ; les holds actifs de réservation **et de commande** sont soustraits.
5. La réservation recontrôle la fraîcheur sous verrou, puis relit l'offre vendable commune. Les quantités concurrentes ne peuvent pas dépasser le stock restant.
6. Le prix et le total de réservation sont recalculés côté serveur depuis `stocks.prix`. Les prix affichés dans le panier sont informatifs et ne sont jamais une autorité de facturation.
7. Une quantité choisie dans le parcours d'une pharmacie est plafonnée à la disponibilité retournée par cette pharmacie (maximum UI actuel : 10). Le serveur reste l'arbitre final.
8. Les frais de livraison ne sont pas mélangés au sous-total médicaments ; ils suivent leur calcul séparé.

## Rôles et écrans concernés

- **Client** : `/resultats`, `/panier`, `/commande/nouvelle`. Affichage de la date d'actualisation, sélection de quantité, sous-total dynamique.
- **Gestionnaire de stock / Magasinier** : leurs opérations existantes de comptage et de mouvement alimentent le journal qui fait foi pour la fraîcheur.
- **Pharmacien / Promoteur / responsables autorisés** : les droits existants de gestion ERP sont conservés ; aucune nouvelle permission de modifier le stock n'est accordée par ce chantier.
- **Caisse** : le débit physique existant à la consommation de la réservation reste inchangé ; le hold n'est pas débité deux fois.

## Fichiers livrés

- `supabase/migrations/20261112195700_marketplace_stock_freshness_48h.sql`
- `supabase/tests/300_marketplace_stock_freshness_48h.sql`
- `src/lib/panier.tsx`
- `src/app/resultats/page.tsx`
- `src/app/commande/nouvelle/page.tsx`

## Vérifications / limites de preuve

- Replay Supabase : présence confirmée du journal avec `occurred_at`, `event_type`, `source_table`, ainsi que des tables `stocks`, `stocks_lots`, `reservations`, `reservation_items`.
- Le circuit `creer_transactions_client` appelle bien `private.reserve_stock`.
- Le test SQL de contrat est ajouté ; son exécution et la compilation TypeScript restent à confirmer.
- La migration n'est pas appliquée à Production. Aucun déploiement Vercel n'est effectué.
