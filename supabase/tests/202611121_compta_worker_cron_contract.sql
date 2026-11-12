-- Contrat du worker comptable planifié.
do $$
declare v_job record; v_result jsonb;
begin
  select jobid,username,schedule,command,active into v_job
  from cron.job where jobname='naxa-compta-worker';
  if not found or v_job.active is not true or v_job.username<>'postgres'
     or v_job.schedule<>'*/5 * * * *'
     or v_job.command<>'select private.compta_worker_traiter_lot(50);' then
    raise exception 'Job pg_cron comptable absent ou configuration incorrecte';
  end if;
  if has_function_privilege('authenticated','private.compta_worker_traiter_lot(integer)','EXECUTE')
     or has_function_privilege('anon','private.compta_worker_traiter_lot(integer)','EXECUTE')
     or not has_function_privilege('postgres','private.compta_worker_traiter_lot(integer)','EXECUTE') then
    raise exception 'ACL du worker cron incorrecte';
  end if;
  select private.compta_worker_traiter_lot(50) into v_result;
  if coalesce((v_result->>'ok')::boolean,false) is not true then
    raise exception 'Worker cron ne termine pas proprement: %',v_result;
  end if;
end $$;
select 'PASS — worker interne réservé postgres, cron actif toutes les 5 minutes' as result;
