-- NAXA 241 — ne pas déclarer le cycle vert si des réservations échouent à la restitution.
begin;

create or replace function public.reservation_lifecycle_cron()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_expiry jsonb := '{}'::jsonb;
  v_notifications integer := 0;
  v_errors jsonb := '[]'::jsonb;
begin
  begin
    v_expiry := public.expirer_reservations_cron(p_limit := 500);
    if coalesce((v_expiry->>'en_echec')::integer, 0) > 0 then
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'step', 'expiration_stock_restore',
        'failedReservations', (v_expiry->>'en_echec')::integer,
        'details', coalesce(v_expiry->'erreurs', '[]'::jsonb)
      ));
    end if;
  exception when others then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'step', 'expiration_stock_restore', 'error', left(sqlerrm, 300)
    ));
  end;

  begin
    v_notifications := public.notifier_reservations_expirant_30m();
  exception when others then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'step', 'notification_30m', 'error', left(sqlerrm, 300)
    ));
  end;

  return jsonb_build_object(
    'ok', jsonb_array_length(v_errors) = 0,
    'expiration', v_expiry,
    'notificationsCreated', v_notifications,
    'errors', v_errors,
    'at', now()
  );
end;
$function$;

revoke all on function public.reservation_lifecycle_cron() from public, anon, authenticated;
grant execute on function public.reservation_lifecycle_cron() to service_role;
comment on function public.reservation_lifecycle_cron() is
  'Cycle serveur unique : ok=false si une expiration/restitution échoue ou si les rappels échouent; inclut les erreurs de chaque réservation pour supervision.';

commit;
