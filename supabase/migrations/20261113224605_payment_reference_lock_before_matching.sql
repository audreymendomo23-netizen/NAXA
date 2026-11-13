do $body$
declare
  v_delivery text;
  v_partner text;
  v_old_delivery_count text := $old$
  select count(*) into v_record_count
  from public.naxa_delivery_payment_records pr
$old$;
  v_new_delivery_count text := $new$
  perform pg_advisory_xact_lock(hashtextextended(v_ref,0));

  select count(*) into v_record_count
  from public.naxa_delivery_payment_records pr
$new$;
  v_old_delivery_late_lock text := $oldl$
  v_channel:=case when v_record.mode='mtn_marchand' then 'mtn_momo' else 'orange_money' end;
  perform pg_advisory_xact_lock(hashtextextended(v_channel||':'||v_ref,0));

$oldl$;
  v_old_partner_count text := $oldp$
  select count(*) into v_intent_count
  from public.naxa_universe_payment_intents i
$oldp$;
  v_new_partner_count text := $newp$
  perform pg_advisory_xact_lock(hashtextextended(v_ref,0));

  select count(*) into v_intent_count
  from public.naxa_universe_payment_intents i
$newp$;
  v_old_partner_late_lock text := $oldq$
  perform pg_advisory_xact_lock(hashtextextended(v_intent.canal||':'||v_ref,0));

$oldq$;
begin
  select pg_get_functiondef('public.naxa_match_delivery_payment_sms(uuid,text)'::regprocedure)
    into v_delivery;
  if position('perform pg_advisory_xact_lock(hashtextextended(v_ref,0))' in v_delivery)=0 then
    if position(v_old_delivery_count in v_delivery)=0
       or position(v_old_delivery_late_lock in v_delivery)=0 then
      raise exception 'Ancrages du verrou Livraison non trouvés';
    end if;
    v_delivery:=replace(v_delivery,v_old_delivery_late_lock,'');
    v_delivery:=replace(v_delivery,v_old_delivery_count,v_new_delivery_count);
    execute v_delivery;
  end if;

  select pg_get_functiondef('public.naxa_match_universe_payment_sms(uuid,text)'::regprocedure)
    into v_partner;
  if position('perform pg_advisory_xact_lock(hashtextextended(v_ref,0))' in v_partner)=0 then
    if position(v_old_partner_count in v_partner)=0
       or position(v_old_partner_late_lock in v_partner)=0 then
      raise exception 'Ancrages du verrou Partenaire non trouvés';
    end if;
    v_partner:=replace(v_partner,v_old_partner_late_lock,'');
    v_partner:=replace(v_partner,v_old_partner_count,v_new_partner_count);
    execute v_partner;
  end if;
end;
$body$;
