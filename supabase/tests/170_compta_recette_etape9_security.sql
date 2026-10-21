-- NAXA Comptable — recette étape 9 : surface de sécurité du socle comptable.
begin;

do $test$
declare
  v_proc oid;
  v_def text;
  v_unprotected text[];
begin
  select p.oid into v_proc
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='compta_ouvrir_periode'
    and pg_get_function_identity_arguments(p.oid)='p_pharmacie uuid, p_date_debut date, p_date_fin date, p_acteur uuid';
  if v_proc is null then raise exception 'FAIL: RPC compta_ouvrir_periode absente'; end if;
  if has_function_privilege('authenticated',v_proc,'EXECUTE') then
    raise exception 'FAIL: authenticated peut ouvrir directement une période';
  end if;
  if not has_function_privilege('service_role',v_proc,'EXECUTE') then
    raise exception 'FAIL: service_role ne peut pas ouvrir une période';
  end if;
  select pg_get_functiondef(v_proc) into v_def;
  if v_def not ilike '%p_date_fin < p_date_debut%'
     or v_def not ilike '%chevauche une période existante%'
     or v_def not ilike '%profiles%'
     or v_def not ilike '%compta_auditer%'
     or v_def not ilike '%pg_advisory_xact_lock%' then
    raise exception 'FAIL: validation date/périmètre/chevauchement/audit/concurrence incomplète';
  end if;

  select array_agg(c.relname order by c.relname) into v_unprotected
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relname like 'compta_%'
    and not c.relrowsecurity;
  if coalesce(array_length(v_unprotected,1),0)>0 then
    raise exception 'FAIL: RLS désactivée sur : %', array_to_string(v_unprotected,', ');
  end if;

  if has_table_privilege('authenticated','public.compta_controles_cloture','INSERT')
     or has_table_privilege('authenticated','public.compta_controles_cloture','UPDATE')
     or has_table_privilege('authenticated','public.compta_controles_cloture','DELETE') then
    raise exception 'FAIL: écriture directe sur contrôles de clôture';
  end if;

  select p.oid into v_proc
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='compta_cloturer_periode'
    and pg_get_function_identity_arguments(p.oid)='p_pharmacie uuid, p_periode uuid, p_acteur uuid';
  if v_proc is null or has_function_privilege('authenticated',v_proc,'EXECUTE')
     or not has_function_privilege('service_role',v_proc,'EXECUTE') then
    raise exception 'FAIL: privilèges de clôture incorrects';
  end if;

  select p.oid into v_proc
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='compta_enregistrer_controle_cloture'
    and pg_get_function_identity_arguments(p.oid)='p_pharmacie uuid, p_periode uuid, p_controle_code text, p_statut text, p_reference_preuve text, p_motif text, p_acteur uuid';
  if v_proc is null or has_function_privilege('authenticated',v_proc,'EXECUTE')
     or not has_function_privilege('service_role',v_proc,'EXECUTE') then
    raise exception 'FAIL: privilèges d''enregistrement des contrôles incorrects';
  end if;

  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='ventes' and column_name='total_net')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='depenses' and column_name='montant')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='tresorerie_mouvements' and column_name='montant')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='dossiers_assurance' and column_name='montant_prise_en_charge') then
    raise exception 'FAIL: une source financière requise n''est pas présente';
  end if;
end
$test$;

select 'PASS 170_compta_recette_etape9_security' as result;
rollback;
