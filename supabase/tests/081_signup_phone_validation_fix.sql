-- NAXA 081 — garantit que le déclencheur utilise le validateur téléphone corrigé.
begin;

do $naxa081$
declare
  v_definition text := pg_get_functiondef('public.handle_new_user()'::regprocedure);
begin
  if position('naxa_phone_valid_for_country' in v_definition) = 0 then
    raise exception 'Échec NAXA 081 : validateur pays/téléphone absent';
  end if;
  if position('raise exception ''Pays ou numéro de téléphone invalide''' in v_definition) > 0 then
    raise exception 'Échec NAXA 081 : message historique réintroduit par la migration 079';
  end if;
  if position('raise exception ''Numéro de téléphone invalide pour le pays sélectionné''' in v_definition) = 0 then
    raise exception 'Échec NAXA 081 : message précis de validation absent';
  end if;
  if position('raise exception ''Pays non pris en charge''' in v_definition) = 0 then
    raise exception 'Échec NAXA 081 : contrôle explicite du pays absent';
  end if;
end;
$naxa081$;

select true as naxa_081_signup_phone_validation_fix_pass;
rollback;
