-- Performance and policy hardening based on Supabase advisors.
-- Keep the policy predicates semantically identical; evaluate auth.uid() once per statement.
DO $$
DECLARE
  p record;
  v_using text;
  v_check text;
  v_roles text;
  v_sql text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '') ~* 'auth[.]uid[[:space:]]*[(][[:space:]]*[)]'
        OR coalesce(with_check, '') ~* 'auth[.]uid[[:space:]]*[(][[:space:]]*[)]'
      )
  LOOP
    v_using := CASE WHEN p.qual IS NULL THEN NULL
      ELSE regexp_replace(p.qual, 'auth[.]uid[[:space:]]*[(][[:space:]]*[)]', '(select auth.uid())', 'gi') END;
    v_check := CASE WHEN p.with_check IS NULL THEN NULL
      ELSE regexp_replace(p.with_check, 'auth[.]uid[[:space:]]*[(][[:space:]]*[)]', '(select auth.uid())', 'gi') END;
    v_roles := array_to_string(p.roles, ', ');
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
    v_sql := format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      p.policyname, p.schemaname, p.tablename, p.permissive, p.cmd, v_roles);
    IF v_using IS NOT NULL THEN
      v_sql := v_sql || format(' USING (%s)', v_using);
    END IF;
    IF v_check IS NOT NULL THEN
      v_sql := v_sql || format(' WITH CHECK (%s)', v_check);
    END IF;
    EXECUTE v_sql;
  END LOOP;
END $$;

-- Remove exact redundant non-unique indexes. Keep stocks_lots_id_uq because
-- existing foreign-key constraints are bound to it; its duplicate requires a
-- dedicated constraint/index reconciliation, not a blind DROP.
DROP INDEX IF EXISTS public.commandes_fournisseurs_lignes_order_idx;
DROP INDEX IF EXISTS public.stocks_lots_produit_idx;
