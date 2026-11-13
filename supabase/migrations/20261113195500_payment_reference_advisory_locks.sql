do $body$
declare
  v_delivery text;
  v_partner text;
  v_old_delivery text := $old$
  for update;

  select * into v_existing
$old$;
  v_new_delivery text := $new$
  for update;

  v_channel:=case when v_record.mode='mtn_marchand' then 'mtn_momo' else 'orange_money' end;
  perform pg_advisory_xact_lock(hashtextextended(v_channel||':'||v_ref,0));

  select * into v_existing
$new$;
  v_old_partner text := $oldp$
  for update;

  select * into v_existing from public.naxa_universe_payment_confirmations c
$oldp$;
  v_new_partner text := $newp$
  for update;

  perform pg_advisory_xact_lock(hashtextextended(v_intent.canal||':'||v_ref,0));

  select * into v_existing from public.naxa_universe_payment_confirmations c
$newp$;
begin
  select pg_get_functiondef('public.naxa_match_delivery_payment_sms(uuid,text)'::regprocedure)
    into v_delivery;
  if position('pg_advisory_xact_lock' in v_delivery)=0 then
    if position(v_old_delivery in v_delivery)=0 then
      raise exception 'Point d''insertion du verrou Livraison introuvable';
    end if;
    execute replace(v_delivery,v_old_delivery,v_new_delivery);
  end if;

  select pg_get_functiondef('public.naxa_match_universe_payment_sms(uuid,text)'::regprocedure)
    into v_partner;
  if position('pg_advisory_xact_lock' in v_partner)=0 then
    if position(v_old_partner in v_partner)=0 then
      raise exception 'Point d''insertion du verrou Partenaire introuvable';
    end if;
    execute replace(v_partner,v_old_partner,v_new_partner);
  end if;
end;
$body$;
