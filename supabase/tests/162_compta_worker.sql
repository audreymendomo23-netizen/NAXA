-- Tests structurels du worker Comptable, à exécuter après les migrations 160/161/worker.
begin;

do $test$
begin
  if to_regprocedure('public.compta_traiter_evenement(uuid,uuid)') is null then
    raise exception 'RPC compta_traiter_evenement absente';
  end if;
  if has_function_privilege('authenticated','public.compta_traiter_evenement(uuid,uuid)','EXECUTE') then
    raise exception 'authenticated peut invoquer le worker comptable';
  end if;
  if not has_function_privilege('service_role','public.compta_traiter_evenement(uuid,uuid)','EXECUTE') then
    raise exception 'service_role ne peut pas invoquer le worker comptable';
  end if;
  if to_regclass('public.compta_mapping_compte') is null
     or to_regclass('public.compta_parametre') is null
     or to_regclass('public.compta_periodes') is null then
    raise exception 'Référentiels comptables nécessaires au worker absents';
  end if;
end;
$test$;

rollback;
