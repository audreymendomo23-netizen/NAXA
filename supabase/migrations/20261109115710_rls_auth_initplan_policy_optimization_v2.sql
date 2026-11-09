-- Corrective pass: wrap direct auth.uid() calls in InitPlans.
-- Only these 31 audited public-schema policies are touched.
-- Roles, commands, permissive mode, and predicates are preserved.
DO $naxa_rls_initplan_v2$
DECLARE
  v_targets text[] := ARRAY[
    'profiles|profiles_self','profiles|profiles_promoteur_children','profiles|profiles_promoteur_update_children',
    'tickets_support|tickets_support_acces','promoteur_pharmacies|promoteur_pharmacies_owner',
    'reservations|resa_read','partners|partners_member_read',
    'naxa_posologie_schedules|Users manage own posology schedules','naxa_push_subscriptions|Users manage own push subscriptions',
    'naxa_professional_assignments|naxa_professional_assignments_team_read','partner_universes|partner_universes_member_read',
    'partner_members|partner_members_self_read','audit_log|audit_log_admin_read','audit_log|audit_log_admin_insert',
    'universe_reservations|universe_reservations_partner_read','stock_movements|stock_movements_partner_insert',
    'partner_products|partner_products_admin_all','universe_reservations|universe_reservations_client_read',
    'universe_reservations|universe_reservations_admin_read','universe_reservation_items|universe_reservation_items_client_read',
    'partner_products|partner_products_member_manage','exam_centers|exam_centers_partner_manage',
    'exam_services|exam_services_partner_manage','exam_packs|exam_packs_partner_manage',
    'exam_pack_items|exam_pack_items_partner_manage','exam_center_hours|exam_hours_partner_manage',
    'exam_slots|exam_slots_partner_manage','exam_appointments|exam_appointments_client_read',
    'exam_appointments|exam_appointments_partner_read','avis_rappels_lots_reseau|avis_rappels_lots_reseau_read',
    'avis_rappels_lots_destinataires|avis_rappels_lots_destinataires_read'
  ];
  v_pair text;
  v_table text;
  v_policy_name text;
  v_policy record;
  v_using text;
  v_check text;
  v_statement text;
  v_updated integer := 0;
BEGIN
  IF cardinality(v_targets) <> 31 THEN
    RAISE EXCEPTION 'Unexpected target policy count: %', cardinality(v_targets);
  END IF;

  FOREACH v_pair IN ARRAY v_targets LOOP
    v_table := split_part(v_pair, '|', 1);
    v_policy_name := split_part(v_pair, '|', 2);

    SELECT * INTO STRICT v_policy
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = v_table
      AND policyname = v_policy_name;

    v_using := v_policy.qual;
    v_check := v_policy.with_check;

    IF v_using IS NOT NULL THEN
      v_using := regexp_replace(
        v_using,
        '[(][[:space:]]*select[[:space:]]+auth[.]uid[(][)]([[:space:]]+as[[:space:]]+[a-z_][a-z0-9_]*)?[[:space:]]*[)]',
        '__NAXA_KEEP_UID_INITPLAN__',
        'gi'
      );
      v_using := regexp_replace(v_using, 'auth[.]uid[(][)]', '(select auth.uid())', 'gi');
      v_using := replace(v_using, '__NAXA_KEEP_UID_INITPLAN__', '(select auth.uid())');

      IF regexp_replace(v_using, '[(][[:space:]]*select[[:space:]]+auth[.]uid[(][)][[:space:]]*[)]', '', 'gi') ~* 'auth[.]uid[(][)]' THEN
        RAISE EXCEPTION 'Unoptimized auth.uid() remains in USING: %.%', v_table, v_policy_name;
      END IF;
    END IF;

    IF v_check IS NOT NULL THEN
      v_check := regexp_replace(
        v_check,
        '[(][[:space:]]*select[[:space:]]+auth[.]uid[(][)]([[:space:]]+as[[:space:]]+[a-z_][a-z0-9_]*)?[[:space:]]*[)]',
        '__NAXA_KEEP_UID_INITPLAN__',
        'gi'
      );
      v_check := regexp_replace(v_check, 'auth[.]uid[(][)]', '(select auth.uid())', 'gi');
      v_check := replace(v_check, '__NAXA_KEEP_UID_INITPLAN__', '(select auth.uid())');

      IF regexp_replace(v_check, '[(][[:space:]]*select[[:space:]]+auth[.]uid[(][)][[:space:]]*[)]', '', 'gi') ~* 'auth[.]uid[(][)]' THEN
        RAISE EXCEPTION 'Unoptimized auth.uid() remains in WITH CHECK: %.%', v_table, v_policy_name;
      END IF;
    END IF;

    v_statement := format('ALTER POLICY %I ON public.%I', v_policy_name, v_table);
    IF v_using IS NOT NULL THEN
      v_statement := v_statement || format(' USING (%s)', v_using);
    END IF;
    IF v_check IS NOT NULL THEN
      v_statement := v_statement || format(' WITH CHECK (%s)', v_check);
    END IF;

    EXECUTE v_statement;
    v_updated := v_updated + 1;
  END LOOP;

  IF v_updated <> 31 THEN
    RAISE EXCEPTION 'Expected 31 policies updated, got %', v_updated;
  END IF;
END;
$naxa_rls_initplan_v2$;
