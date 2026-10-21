-- NAXA Comptable — test structurel de la RPC d'enregistrement des contrôles.
begin;
do $test$
declare
  v_proc oid;
  v_def text;
begin
  select p.oid into v_proc
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='compta_enregistrer_controle_cloture'
    and pg_get_function_identity_arguments(p.oid) =
      'p_pharmacie uuid, p_periode uuid, p_controle_code text, p_statut text, p_reference_preuve text, p_motif text, p_acteur uuid';
  if v_proc is null then raise exception 'FAIL: RPC contrôle clôture absente'; end if;
  if has_function_privilege('authenticated',v_proc,'EXECUTE') then
    raise exception 'FAIL: authenticated peut écrire directement les contrôles';
  end if;
  if not has_function_privilege('service_role',v_proc,'EXECUTE') then
    raise exception 'FAIL: service_role ne peut pas enregistrer les contrôles';
  end if;
  select pg_get_functiondef(v_proc) into v_def;
  if v_def not ilike '%reference de preuve est obligatoire%'
     or v_def not ilike '%motif est obligatoire%'
     or v_def not ilike '%profiles%'
     or v_def not ilike '%compta_auditer%' then
    raise exception 'FAIL: validation preuve/acteur/audit manquante';
  end if;
end
$test$;
select 'PASS 169_compta_controles_cloture_rpc' as result;
rollback;
