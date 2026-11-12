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
3. Dès qu'un historique de journal existe, seules les dates des événements physiques sont utilisées. `stocks.updated_at` n'est utilisé qu'en compatibilité pour une référence totalement dépourvue de journal historique. Une modification de prix ou d'emplacement ne réactive donc pas un stock ancien.
4. Le seuil est réellement inclusif : exactement 48 h reste publiable ; 48 h et 1 seconde est masqué.
4. Les stocks lotisés utilisent les lots non bloqués et non périmés ; les holds actifs de réservation **et de commande** sont soustraits.
5. Les recherches simple et multi-produits passent désormais par `marketplace_offre_stock_disponible`. La réservation recontrôle la fraîcheur sous verrou, puis relit cette même offre vendable. Les quantités concurrentes ne peuvent pas dépasser le stock restant.
6. Le prix et le total de réservation sont recalculés côté serveur depuis `stocks.prix`. Les prix affichés dans le panier sont informatifs et ne sont jamais une autorité de facturation.
7. Une quantité choisie dans le parcours d'une pharmacie est plafonnée à `min(stock disponible, 10)` : le plafond technique historique de 10 unités par ligne est conservé. Le serveur reste l'arbitre final.
8. Les frais de livraison ne sont pas mélangés au sous-total médicaments ; ils suivent leur calcul séparé.

## Rôles et écrans concernés

- **Client** : `/resultats`, `/panier`, `/commande/nouvelle`. Affichage de la date d'actualisation, sélection de quantité, sous-total dynamique.
- **Gestionnaire de stock / Magasinier** : leurs opérations existantes de comptage et de mouvement alimentent le journal ; l'écran Stock & logistique affiche le statut Marketplace calculé depuis le journal physique. Si le journal n'est pas lisible, l'interface n'affiche pas de faux statut vert.
- **Pharmacien / Pharmacien assistant / Responsable / Promoteur / Admin** : le périmètre UI correspond aux rôles déjà autorisés par les RPC métier ; aucune permission de stock supplémentaire n'est accordée par le chantier.
- **Pharmacien / Promoteur / responsables autorisés** : les droits existants de gestion ERP sont conservés ; aucune nouvelle permission de modifier le stock n'est accordée par ce chantier.
- **Caisse** : le débit physique existant à la consommation de la réservation reste inchangé ; le hold n'est pas débité deux fois.

## Fichiers livrés

- `supabase/migrations/20261112190943_marketplace_stock_freshness_48h.sql`
- `supabase/migrations/20261112191030_marketplace_search_freshness_gate.sql`
- `supabase/migrations/20261112191133_marketplace_stock_freshness_confirmation.sql`
- `supabase/migrations/20261112191300_marketplace_stock_metadata_freshness_guard.sql`
- `supabase/migrations/20261112191400_marketplace_stock_freshness_inclusive_boundary.sql`
- `supabase/tests/300_marketplace_stock_freshness_48h.sql`
- `supabase/tests/301_marketplace_search_freshness_gate.sql`
- `supabase/tests/302_marketplace_stock_freshness_confirmation.sql`
- `supabase/tests/303_marketplace_stock_metadata_freshness_guard.sql`
- `supabase/tests/304_marketplace_48h_inclusive_boundary.sql`
- `src/lib/panier.tsx`
- `src/app/resultats/page.tsx`
- `src/app/commande/nouvelle/page.tsx`

## Vérifications / limites de preuve

- Replay Supabase : les cinq migrations de fraîcheur sont appliquées ; les tests SQL 300 à 304 retournent PASS.
- Un test transactionnel vérifie qu'une modification de prix ne renouvelle pas l'horodatage du dernier mouvement physique.
- Un test transactionnel vérifie le seuil inclusif : 48 h = visible ; 48 h + 1 seconde = masqué.
- Les deux fonctions de recherche ont été vérifiées en base : elles appellent le calcul commun du stock vendable.
- Le circuit `creer_transactions_client` appelle bien `private.reserve_stock` ; l'accès `anon` à la fonction privée de réservation est refusé.
- Le Replay contient 100 lignes de stock de démonstration, toutes âgées de plus de 48 h : le Marketplace n'en publie donc aucune, conformément à la règle. Ces données de démonstration ne sont pas rafraîchies artificiellement.
- La compilation TypeScript et le parcours navigateur complet restent à confirmer.
- Aucune migration Production et aucun déploiement Vercel n'ont été effectués.
