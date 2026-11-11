-- Smoke tests statiques de l’ERP Examens (à exécuter après migrations).
do $$
declare
  v_table text;
  v_tables text[] := array[
    'exam_staff_assignments','exam_results','exam_result_contents','exam_result_files','exam_result_access_log',
    'exam_equipment','exam_equipment_maintenance','exam_security_incidents','exam_security_audit_log',
    'exam_accounting_events','exam_conversations','exam_messages','exam_notifications','exam_ai_action_audit'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass('public.'||v_table) is null then raise exception 'FAIL: table absente %',v_table; end if;
    if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=v_table and c.relrowsecurity) then
      raise exception 'FAIL: RLS désactivée sur %',v_table;
    end if;
    if not exists(select 1 from pg_policies p where p.schemaname='public' and p.tablename=v_table) then
      raise exception 'FAIL: aucune policy sur %',v_table;
    end if;
  end loop;
  if exists(select 1 from pg_constraint where conrelid='public.exam_centers'::regclass and conname='exam_centers_partner_id_key') then
    raise exception 'FAIL: unicité partenaire-centre toujours présente';
  end if;
  if (select prosecdef from pg_proc where oid='public.exam_create_result_draft(uuid,uuid,text,text,text)'::regprocedure) then
    raise exception 'FAIL: RPC création brouillon doit rester SECURITY INVOKER';
  end if;
  if (select prosecdef from pg_proc where oid='public.exam_set_active_role(uuid,uuid)'::regprocedure) then
    raise exception 'FAIL: RPC rôle actif doit rester SECURITY INVOKER';
  end if;
  if (select prosecdef from pg_proc where oid='public.transition_exam_appointment(uuid,text)'::regprocedure) then
    raise exception 'FAIL: RPC transition rendez-vous doit rester SECURITY INVOKER';
  end if;
  if (select public from storage.buckets where id='exam-results') then raise exception 'FAIL: bucket résultats public'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='exam_result_contents'
    and policyname='exam_result_contents_client_published_read' and qual ilike '%published%') then
    raise exception 'FAIL: policy client résultats publiés absente';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='exam_result_access_log'
    and policyname='exam_result_access_log_insert') then raise exception 'FAIL: journal accès résultats absent'; end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='exam_appointments'
    and policyname='exam_appointments_staff_update') then raise exception 'FAIL: politique RLS transition rendez-vous absente'; end if;
end;
$$;
select 'PASS: ERP, RLS, multi-centres, stockage privé et transitions SECURITY INVOKER' as test_result;
