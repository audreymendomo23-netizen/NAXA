-- NAXA Comptable — test structurel étape 8 : clôture et séparation des privilèges.
begin;

do $test$
declare
  v_proc oid;
  v_result text;
begin
  select p.oid into v_proc
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'compta_cloturer_periode'
    and pg_get_function_identity_arguments(p.oid) = 'p_pharmacie uuid, p_periode uuid, p_acteur uuid';

  if v_proc is null then
    raise exception 'FAIL: RPC compta_cloturer_periode absente';
  end if;
  if has_function_privilege('authenticated', v_proc, 'EXECUTE') then
    raise exception 'FAIL: authenticated peut exécuter la clôture comptable';
  end if;
  if not has_function_privilege('service_role', v_proc, 'EXECUTE') then
    raise exception 'FAIL: service_role ne peut pas exécuter la clôture comptable';
  end if;

  if not exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'compta_controles_cloture'
  ) then raise exception 'FAIL: table de contrôles de clôture absente'; end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'compta_controles_cloture'
      and policyname = 'compta_controles_cloture_read' and cmd = 'SELECT'
  ) then raise exception 'FAIL: politique de lecture du périmètre comptable absente'; end if;

  if has_table_privilege('authenticated', 'public.compta_controles_cloture', 'INSERT')
     or has_table_privilege('authenticated', 'public.compta_controles_cloture', 'UPDATE')
     or has_table_privilege('authenticated', 'public.compta_controles_cloture', 'DELETE') then
    raise exception 'FAIL: authenticated dispose d''un droit d''écriture direct sur les contrôles';
  end if;

  select pg_get_functiondef(v_proc) into v_result;
  if v_result not ilike '%dotations%' or v_result not ilike '%paie%'
     or v_result not ilike '%tva%' or v_result not ilike '%stock%'
     or v_result not ilike '%regularisations%' or v_result not ilike '%a_nouveaux%'
     or v_result not ilike '%compta_verifier_audit%' then
    raise exception 'FAIL: la clôture ne contient pas tous les contrôles obligatoires';
  end if;
end
$test$;

select 'PASS 167_compta_cloture_etape8_structure' as result;
rollback;
