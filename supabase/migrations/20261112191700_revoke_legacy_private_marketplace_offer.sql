-- Fermer l'ancien RPC privé qui lisait les stocks bruts sans fraîcheur.
-- Aucun autre objet SQL ne l'appelle ; les parcours utilisent la fonction publique contrôlée.
begin;
revoke all on function private.marketplace_offre_stock_disponible(uuid,uuid) from public, anon, authenticated;
commit;
