-- NAXA — remove four identical redundant indexes without dropping the
-- constraint-backed unique index on stocks_lots.id.
-- The production schema already has only the canonical index in each pair;
-- IF EXISTS keeps this migration safe on environments where duplicates are absent.
BEGIN;

DROP INDEX IF EXISTS public.abonnements_pharmacie_unique_base;
DROP INDEX IF EXISTS public.commandes_fournisseurs_lignes_order_idx;
DROP INDEX IF EXISTS public.reservation_events_pharmacie_idx;
-- Keep stocks_lots_id_uidx: it backs the unique constraint referenced by
-- foreign keys. stocks_lots_id_uq is the unreferenced duplicate.
DROP INDEX IF EXISTS public.stocks_lots_id_uq;

COMMIT;
