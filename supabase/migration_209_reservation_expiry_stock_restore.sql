-- NAXA 209 — expiration automatique et restitution du stock des réservations arrivées à échéance.
begin;
create or replace function public.expirer_reservations_cron(p_limit integer default 500)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
 v_row record; v_expired integer:=0; v_failed integer:=0; v_errors jsonb:='[]'::jsonb;
begin
 if p_limit is null or p_limit<1 or p_limit>5000 then raise exception 'Limite cron invalide'; end if;
 for v_row in
  select r.id
  from public.reservations r
  where r.statut in ('en_attente','confirmee') and r.expires_at<=now()
  order by r.expires_at,r.id
  for update skip locked
  limit p_limit
 loop
  begin
   -- Restitution lot/stock et statut sont dans la même transaction.
   perform public.restore_stock(v_row.id);
   update public.reservations set statut='expiree' where id=v_row.id and statut in ('en_attente','confirmee');
   if found then v_expired:=v_expired+1; end if;
  exception when others then
   -- Une incohérence sur un dossier ne doit pas annuler tout le lot cron.
   -- Le dossier reste actif et sera signalé/retry au prochain passage.
   v_failed:=v_failed+1;
   v_errors:=v_errors||jsonb_build_array(jsonb_build_object('reservation_id',v_row.id,'erreur',left(sqlerrm,300)));
  end;
 end loop;
 return jsonb_build_object('expirees',v_expired,'en_echec',v_failed,'erreurs',v_errors,'traite_le',now());
end;
$function$;
revoke all on function public.expirer_reservations_cron(integer) from public,anon,authenticated;
grant execute on function public.expirer_reservations_cron(integer) to service_role;
comment on function public.expirer_reservations_cron(integer) is
 'Expire les réservations en attente/confirmées après échéance, restitue les lots et le stock agrégé atomiquement, et laisse les dossiers incohérents ouverts avec erreur traçable pour réconciliation.';

do $schedule$
begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  if not exists(select 1 from cron.job where jobname='naxa-reservation-expire-stock-restore') then
   perform cron.schedule('naxa-reservation-expire-stock-restore','*/5 * * * *','select public.expirer_reservations_cron(500);');
  end if;
 end if;
exception when undefined_table or insufficient_privilege then
 raise notice 'pg_cron indisponible : planifier expirer_reservations_cron via un ordonnanceur serveur authentifié.';
end;
$schedule$;
commit;
