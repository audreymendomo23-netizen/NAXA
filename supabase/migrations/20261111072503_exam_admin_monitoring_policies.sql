-- NAXA — visibilité Admin des métadonnées opérationnelles Examens.
-- Les contenus médicaux et pièces jointes restent privés au client et aux professionnels habilités.
begin;

drop policy if exists exam_staff_admin_read on public.exam_staff_assignments;
create policy exam_staff_admin_read on public.exam_staff_assignments
for select to authenticated using (public.is_admin());

drop policy if exists exam_results_admin_metadata_read on public.exam_results;
create policy exam_results_admin_metadata_read on public.exam_results
for select to authenticated using (public.is_admin());

drop policy if exists exam_equipment_maintenance_admin_read on public.exam_equipment_maintenance;
create policy exam_equipment_maintenance_admin_read on public.exam_equipment_maintenance
for select to authenticated using (public.is_admin());

drop policy if exists exam_result_access_log_admin_read on public.exam_result_access_log;
create policy exam_result_access_log_admin_read on public.exam_result_access_log
for select to authenticated using (public.is_admin());

drop policy if exists exam_conversations_admin_metadata_read on public.exam_conversations;
create policy exam_conversations_admin_metadata_read on public.exam_conversations
for select to authenticated using (public.is_admin());

commit;
