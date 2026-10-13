-- Test structurel et comportemental NAXA 079 ; rollback systématique.
begin;
do $test$
declare
  fn regprocedure;
  source text;
begin
  fn := to_regprocedure('private.naxa_phone_valid_for_country(text,text)');
  if fn is null then
    raise exception 'Validateur téléphone privé absent';
  end if;

  if not private.naxa_phone_valid_for_country('CM', '+237612345678') then
    raise exception 'Un numéro camerounais valide est rejeté';
  end if;
  if private.naxa_phone_valid_for_country('CM', '+237123') then
    raise exception 'Un numéro camerounais incomplet est accepté';
  end if;
  if not private.naxa_phone_valid_for_country('GA', '+24101234567') then
    raise exception 'Un numéro gabonais valide est rejeté';
  end if;

  select pg_get_functiondef('public.handle_new_user()'::regprocedure) into source;
  if position('private.naxa_phone_valid_for_country' in source) = 0 then
    raise exception 'Le déclencheur ne délègue pas la validation au validateur corrigé';
  end if;
  if position('raw_app_meta_data' in source) = 0 or position('google' in lower(source)) = 0 then
    raise exception 'La branche de compatibilité Google OAuth est absente';
  end if;
end;
$test$;
select true as naxa_079_signup_phone_validation_pass;
rollback;
