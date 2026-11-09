-- NAXA — indexation complémentaire des FK Caisse, POS, Stock et Approvisionnement.
-- Index non uniques, avec colonne FK en tête ; index existants conservés.

create index if not exists idx_caisses_sessions_cloture_par
  on public.caisses_sessions (cloture_par);

create index if not exists idx_caisses_sessions_ouvert_par
  on public.caisses_sessions (ouvert_par);

create index if not exists idx_reservation_item_lots_produit_id
  on public.reservation_item_lots (produit_id);

create index if not exists idx_vente_paiements_created_by
  on public.vente_paiements (created_by);

create index if not exists idx_fournisseurs_created_by
  on public.fournisseurs (created_by);

create index if not exists idx_stock_service_sessions_gestionnaire_id
  on public.stock_service_sessions (gestionnaire_id);

create index if not exists idx_commandes_fournisseurs_created_by
  on public.commandes_fournisseurs (created_by);

create index if not exists idx_commandes_fournisseurs_fournisseur_id
  on public.commandes_fournisseurs (fournisseur_id);

create index if not exists idx_inventaire_lignes_lot_id
  on public.inventaire_lignes (lot_id);

create index if not exists idx_inventaire_lignes_produit_id
  on public.inventaire_lignes (produit_id);

create index if not exists idx_inventaires_closed_by
  on public.inventaires (closed_by);

create index if not exists idx_inventaires_created_by
  on public.inventaires (created_by);

create index if not exists idx_commandes_fournisseurs_lignes_produit_id
  on public.commandes_fournisseurs_lignes (produit_id);

create index if not exists idx_receptions_fournisseurs_recu_par
  on public.receptions_fournisseurs (recu_par);

create index if not exists idx_inventaire_ajustements_acteur_id
  on public.inventaire_ajustements (acteur_id);

create index if not exists idx_inventaire_ajustements_ligne_id
  on public.inventaire_ajustements (ligne_id);

create index if not exists idx_inventaire_ajustements_lot_id
  on public.inventaire_ajustements (lot_id);

create index if not exists idx_inventaire_ajustements_produit_id
  on public.inventaire_ajustements (produit_id);

create index if not exists idx_receptions_fournisseurs_lignes_commande_ligne_id
  on public.receptions_fournisseurs_lignes (commande_ligne_id);

create index if not exists idx_stock_manager_transfers_acteur_id
  on public.stock_manager_transfers (acteur_id);

create index if not exists idx_stock_manager_transfers_destination_lot_id
  on public.stock_manager_transfers (destination_lot_id);

create index if not exists idx_stock_manager_transfers_produit_id
  on public.stock_manager_transfers (produit_id);

create index if not exists idx_stock_manager_transfers_source_lot_id
  on public.stock_manager_transfers (source_lot_id);

create index if not exists idx_stock_service_inventory_counts_counted_by
  on public.stock_service_inventory_counts (counted_by);

create index if not exists idx_stock_service_inventory_counts_produit_id
  on public.stock_service_inventory_counts (produit_id);
