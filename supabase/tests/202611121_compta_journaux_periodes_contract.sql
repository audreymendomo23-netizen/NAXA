-- Contrat des journaux/périodes et des mappings réellement consommés par le worker.
do $$
declare v_count integer; v_def text;
begin
  select count(*) into v_count from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in (
    'compta_config_lire','compta_config_enregistrer_journal','compta_config_valider_journal','compta_config_ouvrir_periode'
  ) and p.prosecdef and p.proconfig @> array['search_path=""'];
  if v_count<>4 then raise exception 'RPC de configuration sécurisées attendues: 4, reçues: %',v_count; end if;
  if has_function_privilege('anon','public.compta_config_lire(uuid)','EXECUTE')
    or has_function_privilege('anon','public.compta_config_enregistrer_journal(uuid,uuid,text,text,date,date)','EXECUTE')
    or has_function_privilege('anon','public.compta_config_valider_journal(uuid,uuid)','EXECUTE')
    or has_function_privilege('anon','public.compta_config_ouvrir_periode(uuid,date,date)','EXECUTE') then
    raise exception 'Les RPC de configuration ne doivent pas être exécutables par anon';
  end if;
  if not has_function_privilege('authenticated','public.compta_config_lire(uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.compta_config_enregistrer_journal(uuid,uuid,text,text,date,date)','EXECUTE')
    or not has_function_privilege('authenticated','public.compta_config_valider_journal(uuid,uuid)','EXECUTE')
    or not has_function_privilege('authenticated','public.compta_config_ouvrir_periode(uuid,date,date)','EXECUTE') then
    raise exception 'Droits authenticated manquants sur les RPC';
  end if;
  foreach v_def in array array[
    pg_get_functiondef('public.compta_config_enregistrer_journal(uuid,uuid,text,text,date,date)'::regprocedure),
    pg_get_functiondef('public.compta_config_valider_journal(uuid,uuid)'::regprocedure),
    pg_get_functiondef('public.compta_config_ouvrir_periode(uuid,date,date)'::regprocedure),
    pg_get_functiondef('public.compta_plan_enregistrer_mapping(uuid,uuid,text,text,uuid,date,date)'::regprocedure),
    pg_get_functiondef('public.compta_plan_valider_mapping(uuid,uuid)'::regprocedure)
  ] loop
    if position('compta_ecriture_autorisee' in v_def)=0 or position('compta_auditer' in v_def)=0 then
      raise exception 'Garde d’écriture ou audit absent d’une RPC';
    end if;
  end loop;
  if position('pg_advisory_xact_lock' in pg_get_functiondef('public.compta_config_ouvrir_periode(uuid,date,date)'::regprocedure))=0
    or position('daterange' in pg_get_functiondef('public.compta_config_valider_journal(uuid,uuid)'::regprocedure))=0
    or position('daterange' in pg_get_functiondef('public.compta_plan_valider_mapping(uuid,uuid)'::regprocedure))=0 then
    raise exception 'Contrôle anti-chevauchement ou verrou concurrent absent';
  end if;
  if position('assurance_prise_en_charge' in pg_get_functiondef('public.compta_plan_enregistrer_mapping(uuid,uuid,text,text,uuid,date,date)'::regprocedure))=0
    or position('vente_annulee' in pg_get_functiondef('public.compta_plan_enregistrer_mapping(uuid,uuid,text,text,uuid,date,date)'::regprocedure))>0 then
    raise exception 'Liste des mappings incompatibles avec les événements worker';
  end if;
end $$;
select 'PASS — configuration journaux/périodes, autorisations, audit, anti-chevauchement et types worker' as result;
