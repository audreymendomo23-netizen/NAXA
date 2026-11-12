-- NAXA — worker comptable interne, déclenché par pg_cron sans secret HTTP.
begin;
create or replace function private.compta_worker_traiter_lot(p_limite integer default 50)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_event record; v_result text;
  v_claimed integer:=0; v_processed integer:=0; v_pending integer:=0; v_errors integer:=0;
begin
  if current_user<>'postgres' then
    raise exception 'Worker comptable interne réservé au rôle postgres' using errcode='42501';
  end if;
  perform pg_catalog.set_config('request.jwt.claim.role','service_role',true);
  for v_event in select * from public.compta_evenements_reclamer(greatest(1,least(coalesce(p_limite,50),100)))
  loop
    v_claimed:=v_claimed+1;
    begin
      v_result:=public.compta_traiter_evenement(v_event.event_id,v_event.claim_token);
      if v_result='traite' then v_processed:=v_processed+1;
      elsif v_result='erreur' then v_errors:=v_errors+1;
      else v_pending:=v_pending+1;
      end if;
    exception when others then
      v_errors:=v_errors+1;
    end;
  end loop;
  return jsonb_build_object('ok',v_errors=0,'reclames',v_claimed,'traite',v_processed,
    'a_traiter',v_pending,'erreurs',v_errors);
end $$;
revoke all on function private.compta_worker_traiter_lot(integer) from public,anon,authenticated,service_role;
grant execute on function private.compta_worker_traiter_lot(integer) to postgres;
do $$ begin
  if not exists(select 1 from pg_extension where extname='pg_cron') then
    raise exception 'Extension pg_cron absente : worker non planifiable';
  end if;
end $$;
select cron.unschedule(jobid) from cron.job where jobname='naxa-compta-worker';
select cron.schedule('naxa-compta-worker','*/5 * * * *','select private.compta_worker_traiter_lot(50);');
commit;
