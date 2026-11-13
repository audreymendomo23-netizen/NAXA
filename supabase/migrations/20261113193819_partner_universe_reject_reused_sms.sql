do $$
declare
  v_definition text;
  v_updated text;
  v_old_filter text := $old$match_status in ('manual_review','coherent_unconfirmed')$old$;
  v_new_filter text := $new$match_status in ('manual_review','coherent_unconfirmed','coherent_confirmed')$new$;
  v_old_receipt text := $old$  v_receipt:='NAXA-PAR-'||to_char(now() at time zone 'Africa/Douala','YYYYMMDD')||'-'||
    lpad(nextval('public.naxa_universe_payment_receipt_seq')::text,8,'0');$old$;
  v_new_receipt text := $new$  if exists (
    select 1 from public.naxa_universe_payment_confirmations c
    where c.canal=v_intent.canal and c.reference_normalisee=v_ref
  ) then
    update public.universe_reservations
    set payment_status='manual_review',updated_at=now()
    where id=v_intent.reservation_id;
    return jsonb_build_object('status','transaction_reference_already_confirmed');
  end if;

  v_receipt:='NAXA-PAR-'||to_char(now() at time zone 'Africa/Douala','YYYYMMDD')||'-'||
    lpad(nextval('public.naxa_universe_payment_receipt_seq')::text,8,'0');$new$;
begin
  select pg_get_functiondef('public.naxa_match_universe_payment_sms(uuid,text)'::regprocedure)
    into v_definition;
  v_updated:=replace(v_definition,v_old_filter,v_new_filter);
  v_updated:=replace(v_updated,v_old_receipt,v_new_receipt);
  if v_updated=v_definition then
    raise exception 'Impossible de renforcer le contrôle anti-réutilisation SMS partenaire';
  end if;
  execute v_updated;
end;
$$;
