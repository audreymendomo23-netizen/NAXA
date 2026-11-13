do $$
declare
  v_definition text;
  v_updated text;
  v_old text := $old$match_status in ('manual_review','coherent_unconfirmed')$old$;
  v_new text := $new$match_status in ('manual_review','coherent_unconfirmed','coherent_confirmed')$new$;
begin
  select pg_get_functiondef('public.naxa_match_delivery_payment_sms(uuid,text)'::regprocedure)
    into v_definition;
  v_updated := replace(v_definition, v_old, v_new);
  if v_updated = v_definition then
    raise exception 'Le filtre anti-réutilisation du SMS marchand est déjà modifié ou non reconnu';
  end if;
  execute v_updated;
end;
$$;
