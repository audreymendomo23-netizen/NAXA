do $$
declare
  v_definition text;
  v_old text := $old$
  if not found then raise exception 'Coordonnées marchandes non activées pour cet opérateur'; end if;
$old$;
  v_new text := $new$
  if not found or coalesce(v_destination.merchant_code,'') !~ '^[0-9]{6}$' then
    raise exception 'Coordonnées marchandes absentes ou code marchand non conforme (6 chiffres requis)';
  end if;
$new$;
begin
  select pg_get_functiondef('public.naxa_universe_get_or_create_payment_intent(uuid,uuid,text)'::regprocedure)
    into v_definition;
  if position(v_old in v_definition)=0 then
    raise exception 'Garde du code marchand non trouvée dans le RPC';
  end if;
  execute replace(v_definition,v_old,v_new);
end;
$$;
