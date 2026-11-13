create or replace function public.naxa_universe_cancel_payment_intent(
  p_reservation uuid,
  p_client uuid
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_res public.universe_reservations%rowtype;
  v_intent public.naxa_universe_payment_intents%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'Service NAXA requis'; end if;
  if p_reservation is null or p_client is null then raise exception 'Réservation et Client requis'; end if;

  select * into v_res from public.universe_reservations
  where id=p_reservation for update;
  if not found or v_res.client_id<>p_client then
    raise exception 'Réservation introuvable pour ce Client';
  end if;

  select * into v_intent from public.naxa_universe_payment_intents
  where reservation_id=p_reservation and status='active'
  order by created_at desc limit 1 for update;
  if not found then
    if v_res.payment_status='awaiting_payment' then
      update public.universe_reservations
      set payment_mode=null,payment_status='not_required',updated_at=now()
      where id=p_reservation;
    end if;
    return true;
  end if;

  update public.naxa_universe_payment_intents
  set status='cancelled',updated_at=now()
  where id=v_intent.id and status='active';
  update public.universe_reservations
  set payment_mode=null,payment_status='not_required',updated_at=now()
  where id=p_reservation and payment_status='awaiting_payment';
  return true;
end;
$function$;

revoke all on function public.naxa_universe_cancel_payment_intent(uuid,uuid)
  from public,anon,authenticated;
grant execute on function public.naxa_universe_cancel_payment_intent(uuid,uuid)
  to service_role;
