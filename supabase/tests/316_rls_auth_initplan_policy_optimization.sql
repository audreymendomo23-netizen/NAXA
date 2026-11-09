-- Regression test for the 31 RLS auth.uid() InitPlan optimizations.
-- Read-only assertions; the transaction is rolled back.

BEGIN;

DO $naxa_rls_initplan_test$
DECLARE
  v_found integer;
  v_metadata_ok integer;
  v_direct_remaining integer;
  v_optimized integer;
  v_rls_tables integer;
  v_rls_enabled integer;
BEGIN
  WITH targets(tablename, policyname, expected_roles, expected_cmd) AS (
    VALUES
      ('profiles','profiles_self','{public}','SELECT'),
      ('profiles','profiles_promoteur_children','{public}','SELECT'),
      ('profiles','profiles_promoteur_update_children','{public}','UPDATE'),
      ('tickets_support','tickets_support_acces','{public}','SELECT'),
      ('promoteur_pharmacies','promoteur_pharmacies_owner','{public}','SELECT'),
      ('reservations','resa_read','{public}','SELECT'),
      ('partners','partners_member_read','{authenticated}','SELECT'),
      ('naxa_posologie_schedules','Users manage own posology schedules','{authenticated}','ALL'),
      ('naxa_push_subscriptions','Users manage own push subscriptions','{authenticated}','ALL'),
      ('naxa_professional_assignments','naxa_professional_assignments_team_read','{authenticated}','SELECT'),
      ('partner_universes','partner_universes_member_read','{authenticated}','SELECT'),
      ('partner_members','partner_members_self_read','{authenticated}','SELECT'),
      ('audit_log','audit_log_admin_read','{authenticated}','SELECT'),
      ('audit_log','audit_log_admin_insert','{authenticated}','INSERT'),
      ('universe_reservations','universe_reservations_partner_read','{authenticated}','SELECT'),
      ('stock_movements','stock_movements_partner_insert','{authenticated}','INSERT'),
      ('partner_products','partner_products_admin_all','{authenticated}','ALL'),
      ('universe_reservations','universe_reservations_client_read','{authenticated}','SELECT'),
      ('universe_reservations','universe_reservations_admin_read','{authenticated}','SELECT'),
      ('universe_reservation_items','universe_reservation_items_client_read','{authenticated}','SELECT'),
      ('partner_products','partner_products_member_manage','{authenticated}','ALL'),
      ('exam_centers','exam_centers_partner_manage','{authenticated}','ALL'),
      ('exam_services','exam_services_partner_manage','{authenticated}','ALL'),
      ('exam_packs','exam_packs_partner_manage','{authenticated}','ALL'),
      ('exam_pack_items','exam_pack_items_partner_manage','{authenticated}','ALL'),
      ('exam_center_hours','exam_hours_partner_manage','{authenticated}','ALL'),
      ('exam_slots','exam_slots_partner_manage','{authenticated}','ALL'),
      ('exam_appointments','exam_appointments_client_read','{authenticated}','SELECT'),
      ('exam_appointments','exam_appointments_partner_read','{authenticated}','SELECT'),
      ('avis_rappels_lots_reseau','avis_rappels_lots_reseau_read','{authenticated}','SELECT'),
      ('avis_rappels_lots_destinataires','avis_rappels_lots_destinataires_read','{authenticated}','SELECT')
  )
  SELECT
    count(*) FILTER (WHERE p.policyname IS NOT NULL),
    count(*) FILTER (
      WHERE p.policyname IS NOT NULL
        AND p.roles::text = t.expected_roles
        AND p.cmd = t.expected_cmd
        AND p.permissive = 'PERMISSIVE'
    ),
    count(*) FILTER (
      WHERE p.policyname IS NOT NULL
        AND regexp_replace(
          coalesce(p.qual,'') || coalesce(p.with_check,''),
          '[(][[:space:]]*select[[:space:]]+auth[.]uid[(][)]([[:space:]]+as[[:space:]]+[a-z_][a-z0-9_]*)?[[:space:]]*[)]',
          '',
          'gi'
        ) ~* 'auth[.]uid[(][)]'
    ),
    count(*) FILTER (
      WHERE p.policyname IS NOT NULL
        AND (
          coalesce(p.qual,'') ~* '[(][[:space:]]*select[[:space:]]+auth[.]uid[(][)]([[:space:]]+as[[:space:]]+[a-z_][a-z0-9_]*)?[[:space:]]*[)]'
          OR coalesce(p.with_check,'') ~* '[(][[:space:]]*select[[:space:]]+auth[.]uid[(][)]([[:space:]]+as[[:space:]]+[a-z_][a-z0-9_]*)?[[:space:]]*[)]'
        )
    )
  INTO v_found, v_metadata_ok, v_direct_remaining, v_optimized
  FROM targets t
  LEFT JOIN pg_policies p
    ON p.schemaname='public'
   AND p.tablename=t.tablename
   AND p.policyname=t.policyname;

  IF v_found <> 31 THEN
    RAISE EXCEPTION 'Expected 31 target policies, found %', v_found;
  END IF;
  IF v_metadata_ok <> 31 THEN
    RAISE EXCEPTION 'Policy access metadata changed: % of 31 match the baseline', v_metadata_ok;
  END IF;
  IF v_direct_remaining <> 0 THEN
    RAISE EXCEPTION 'Unoptimized auth.uid() calls remain in % policies', v_direct_remaining;
  END IF;
  IF v_optimized <> 31 THEN
    RAISE EXCEPTION 'Expected 31 policies with InitPlan-wrapped auth.uid(), got %', v_optimized;
  END IF;

  WITH targets(tablename) AS (
    VALUES
      ('profiles'),('tickets_support'),('promoteur_pharmacies'),('reservations'),('partners'),
      ('naxa_posologie_schedules'),('naxa_push_subscriptions'),('naxa_professional_assignments'),
      ('partner_universes'),('partner_members'),('audit_log'),('universe_reservations'),
      ('stock_movements'),('partner_products'),('universe_reservation_items'),('exam_centers'),
      ('exam_services'),('exam_packs'),('exam_pack_items'),('exam_center_hours'),('exam_slots'),
      ('exam_appointments'),('avis_rappels_lots_reseau'),('avis_rappels_lots_destinataires')
  ),
  distinct_targets AS (SELECT DISTINCT tablename FROM targets)
  SELECT
    count(*),
    count(*) FILTER (WHERE c.relrowsecurity)
  INTO v_rls_tables, v_rls_enabled
  FROM distinct_targets t
  JOIN pg_class c ON c.relname=t.tablename
  JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public';

  IF v_rls_tables <> 24 OR v_rls_enabled <> 24 THEN
    RAISE EXCEPTION 'Expected RLS enabled on 24 affected tables; found % tables and % enabled',
      v_rls_tables, v_rls_enabled;
  END IF;
END;
$naxa_rls_initplan_test$;

ROLLBACK;
