-- NAXA — contrat structurel du plan comptable et des mappings.
do $$
declare
  v_fn text;
  v_name text;
  v_sig text;
begin
  if to_regclass('public.compta_plan_comptable') is null or to_regclass('public.compta_mapping_compte') is null then
    raise exception 'Tables plan ou mapping absentes';
  end if;
  v_name := 'compta_plan_lister_pharmacies';
  foreach v_name in array array['compta_plan_lister_pharmacies','compta_plan_lire','compta_plan_enregistrer_compte','compta_plan_valider_compte','compta_plan_enregistrer_mapping','compta_plan_valider_mapping'] loop
    if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=v_name) then
      raise exception 'RPC manquante: %',v_name;
    end if;
    if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname=v_name
        and (not p.prosecdef or coalesce(array_to_string(p.proconfig,','),'') not like '%search_path=""%')) then
      raise exception 'RPC non SECURITY DEFINER/search_path vide: %',v_name;
    end if;
    if exists(select 1 from information_schema.routine_privileges
      where specific_schema='public' and routine_name=v_name and grantee in ('anon','PUBLIC')) then
      raise exception 'Exécution anonyme non révoquée: %',v_name;
    end if;
    if not exists(select 1 from information_schema.routine_privileges
      where specific_schema='public' and routine_name=v_name and grantee='authenticated' and privilege_type='EXECUTE') then
      raise exception 'Exécution authentifiée absente: %',v_name;
    end if;
  end loop;
  v_fn:=pg_get_functiondef('public.compta_plan_enregistrer_compte(uuid,uuid,text,text,smallint)'::regprocedure);
  if position('compta_ecriture_autorisee' in v_fn)=0 or position('compta_auditer' in v_fn)=0 then
    raise exception 'Enregistrement compte sans garde d’écriture ou audit';
  end if;
  v_fn:=pg_get_functiondef('public.compta_plan_valider_compte(uuid,uuid)'::regprocedure);
  if position('compta_ecriture_autorisee' in v_fn)=0 or position('statut=''a_valider''' in v_fn)=0 then
    raise exception 'Validation compte non protégée ou statut non contrôlé';
  end if;
  v_fn:=pg_get_functiondef('public.compta_plan_enregistrer_mapping(uuid,uuid,text,text,uuid,date,date)'::regprocedure);
  if position('compta_ecriture_autorisee' in v_fn)=0 or position('statut=''valide''' in v_fn)=0 or position('compta_auditer' in v_fn)=0 then
    raise exception 'Mapping non protégé, compte non validé non bloqué, ou audit absent';
  end if;
  v_fn:=pg_get_functiondef('public.compta_plan_valider_mapping(uuid,uuid)'::regprocedure);
  if position('compta_ecriture_autorisee' in v_fn)=0 or position('daterange' in v_fn)=0 or position('compta_auditer' in v_fn)=0 then
    raise exception 'Validation mapping sans garde, anti-chevauchement ou audit';
  end if;
  v_fn:=pg_get_functiondef('public.compta_plan_valider_plan(uuid)'::regprocedure);
  if position('compta_ecriture_autorisee' in v_fn)=0 or position('compta_auditer' in v_fn)=0 then
    raise exception 'Validation globale du plan non protégée ou non auditée';
  end if;
  v_fn:=pg_get_functiondef('public.compta_plan_lire(uuid)'::regprocedure);
  if position('compta_scope_autorise' in v_fn)=0 or position('ecriture_autorisee' in v_fn)=0 then
    raise exception 'Lecture partagée ou état du droit manquant';
  end if;
  raise notice 'PASS plan comptable : RBAC, audit, comptes validés requis, mappings sans chevauchement';
end $$;
select '202611121_compta_plan_mappings_contract PASS' as resultat;
