-- NAXA 074 — vérifie que le déclencheur d'inscription ne rejette plus
-- systématiquement les numéros valides via une branche ELSE historique.
begin;

do $naxa074$
declare
  v_definition text := pg_get_functiondef('public.handle_new_user()'::regprocedure);
begin
  if position('naxa_phone_valid_for_country' in v_definition) = 0 then
    raise exception 'Échec NAXA 074 : handle_new_user() n''utilise pas le validateur pays/téléphone';
  end if;

  if position('raise exception ''Pays ou numéro de téléphone invalide''' in v_definition) > 0 then
    raise exception 'Échec NAXA 074 : ancienne branche ELSE qui rejetait les pays valides toujours présente';
  end if;

  if position('raise exception ''Pays non pris en charge''' in v_definition) = 0 then
    raise exception 'Échec NAXA 074 : validation explicite des pays non pris en charge absente';
  end if;
end;
$naxa074$;

select true as naxa_074_signup_trigger_repair_pass;
rollback;
