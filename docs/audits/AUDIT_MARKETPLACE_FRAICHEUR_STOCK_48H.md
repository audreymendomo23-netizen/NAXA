# Audit — fraîcheur des stocks et quantités Marketplace Pharmacie

Date : 12 novembre 2026  
Périmètre : Marketplace Pharmacie, panier client, réservation/commande et stock ERP.  
Gouvernance : branche `main` uniquement ; aucun déploiement Production.

## État initial observé

- `public.marketplace_offre_stock_disponible(uuid, uuid)` calculait le stock vendable (lots, péremption et holds), mais ne rejetait pas un stock ancien de plus de 48 h.
- `private.reserve_stock(uuid, jsonb)`, appelée par `public.creer_transactions_client`, verrouillait les lignes de stock et vérifiait la quantité et le prix côté serveur, mais ne contrôlait pas la fraîcheur.
- Les read models `search_pharmacies` et `search_pharmacies_bulk` lisaient directement `stocks` et contournaient le calcul commun du stock vendable.
- `src/app/panier/page.tsx` avait déjà des contrôles `− / +`, plafonnés à 10 par défaut.
- Après sélection d'une pharmacie, `src/app/resultats/page.tsx` transférait les articles au panier sans conserver le prix et la quantité réellement disponibles de cette pharmacie.
- `src/app/commande/nouvelle/page.tsx` affichait la quantité sans permettre de la modifier et ne présentait pas de sous-total dynamique des médicaments.

## Décisions et règles appliquées

1. Le seuil est inclusif : un stock âgé de 48 h exactement reste admissible ; au-delà, il est exclu.
2. La fraîcheur repose sur un mouvement réel de quantité du journal `stock_manager_movement_journal` (`creation`, `quantite`, `suppression`). Une modification de prix ou de métadonnée ne renouvelle pas artificiellement le stock.
3. La date de fraîcheur est le plus récent de l'horodatage du journal des mouvements physiques et de `stocks.updated_at`. Cela couvre aussi un inventaire qui confirme la même quantité sans créer de delta. Sans date exploitable, l'offre est masquée.
4. Les stocks lotisés utilisent les lots non bloqués et non périmés ; les holds actifs de réservation **et de commande** sont soustraits.
5. Les recherches simple et multi-produits passent désormais par `marketplace_offre_stock_disponible`. La réservation recontrôle la fraîcheur sous verrou, puis relit cette même offre vendable. Les quantités concurrentes ne peuvent pas dépasser le stock restant.
6. Le prix et le total de réservation sont recalculés côté serveur depuis `stocks.prix`. Les prix affichés dans le panier sont informatifs et ne sont jamais une autorité de facturation.
7. Une quantité choisie dans le parcours d'une pharmacie est plafonnée à la disponibilité retournée par cette pharmacie (maximum UI actuel : 10). Le serveur reste l'arbitre final.
8. Les frais de livraison ne sont pas mélangés au sous-total médicaments ; ils suivent leur calcul séparé.

## Rôles et écrans concernés

- **Client** : `/resultats`, `/panier`, `/commande/nouvelle`. Affichage de la date d'actualisation, sélection de quantité, sous-total dynamique.
- **Gestionnaire de stock / Magasinier** : leurs opérations existantes de comptage et de mouvement alimentent le journal ; l'écran Stock & logistique affiche maintenant le statut Marketplace et l'horodatage de chaque référence.
- **Pharmacien / Promoteur / responsables autorisés** : les droits existants de gestion ERP sont conservés ; aucune nouvelle permission de modifier le stock n'est accordée par ce chantier.
- **Caisse** : le débit physique existant à la consommation de la réservation reste inchangé ; le hold n'est pas débité deux fois.

## Fichiers livrés

- `supabase/migrations/20261112195700_marketplace_stock_freshness_48h.sql`
- `supabase/migrations/20261112201500_marketplace_search_freshness_gate.sql`
- `supabase/migrations/20261112210000_marketplace_stock_freshness_confirmation.sql`
- `supabase/tests/300_marketplace_stock_freshness_48h.sql`
- `supabase/tests/301_marketplace_search_freshness_gate.sql`
- `supabase/tests/302_marketplace_stock_freshness_confirmation.sql`
- `src/lib/panier.tsx`
- `src/app/resultats/page.tsx`
- `src/app/commande/nouvelle/page.tsx`

## Vérifications / limites de preuve

- Replay Supabase : les trois migrations ont été appliquées ; les tests SQL 300, 301 et 302 retournent PASS.
- Les deux fonctions de recherche ont été vérifiées en base : elles appellent le calcul commun du stock vendable.
- Le circuit `creer_transactions_client` appelle bien `private.reserve_stock`.
- Le Replay contient 100 lignes de stock de démonstration, toutes âgées de plus de 48 h : le Marketplace n'en publie donc aucune, conformément à la règle. Ces données de démonstration ne sont pas rafraîchies artificiellement.
- La compilation TypeScript et le parcours navigateur complet restent à confirmer.
- Aucune migration Production et aucun déploiement Vercel n'ont été effectués.
