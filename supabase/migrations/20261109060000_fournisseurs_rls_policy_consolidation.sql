-- NAXA — remove legacy permissive supplier policies that bypass the staff allow-list.
-- The four *_staff policies created by migration 197 remain the sole authenticated
-- access contract for the supplier directory. This changes policies only; no rows.

BEGIN;

DROP POLICY IF EXISTS fournisseurs_scope ON public.fournisseurs;
DROP POLICY IF EXISTS fournisseurs_read_scope ON public.fournisseurs;
DROP POLICY IF EXISTS fournisseurs_insert_scope ON public.fournisseurs;
DROP POLICY IF EXISTS fournisseurs_update_scope ON public.fournisseurs;
DROP POLICY IF EXISTS fournisseurs_delete_scope ON public.fournisseurs;

COMMIT;
