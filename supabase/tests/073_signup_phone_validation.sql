-- NAXA 073 — tests comportementaux de validation pays/téléphone.
begin;

do $naxa073$
declare
  r record;
  v_actual boolean;
  v_total integer := 0;
begin
  for r in
    select * from (values
      ('CM', '+237612345678', true,  'Cameroun valide'),
      ('CM', '+23761234567',  false, 'Cameroun longueur invalide'),
      ('CF', '+23670123456', true,  'Centrafrique valide'),
      ('CF', '+2367012345',  false, 'Centrafrique longueur invalide'),
      ('TD', '+23566123456', true,  'Tchad valide'),
      ('TD', '+2356612345',  false, 'Tchad longueur invalide'),
      ('CG', '+242061234567', true,  'Congo valide'),
      ('CG', '+24206123456',  false, 'Congo longueur invalide'),
      ('CD', '+243991234567', true,  'RDC valide'),
      ('CD', '+24399123456',  false, 'RDC longueur invalide'),
      ('GQ', '+240222123456', true,  'Guinée équatoriale valide'),
      ('GQ', '+24022212345',  false, 'Guinée équatoriale longueur invalide'),
      ('GA', '+24106123456', true,  'Gabon valide'),
      ('GA', '+2410612345',  false, 'Gabon longueur invalide'),
      ('ST', '+2399912345', true,  'Sao Tomé valide'),
      ('ST', '+239991234',  false, 'Sao Tomé longueur invalide'),
      ('AO', '+244921234567', true,  'Angola valide'),
      ('AO', '+24492123456',  false, 'Angola longueur invalide'),
      ('BI', '+25779123456', true,  'Burundi valide'),
      ('BI', '+2577912345',  false, 'Burundi longueur invalide'),
      ('RW', '+250781234567', true,  'Rwanda valide'),
      ('RW', '+25078123456',  false, 'Rwanda longueur invalide'),
      ('ZZ', '+999123456789', false, 'Pays inconnu'),
      ('CM', null, false, 'Téléphone absent')
    ) as cases(country, phone, expected, label)
  loop
    v_actual := private.naxa_phone_valid_for_country(r.country, r.phone);
    if v_actual is distinct from r.expected then
      raise exception 'Échec test téléphone 073 : % (attendu %, obtenu %)',
        r.label, r.expected, v_actual;
    end if;
    v_total := v_total + 1;
  end loop;

  if v_total <> 24 then
    raise exception 'Nombre de cas de test inattendu : % sur 24', v_total;
  end if;

  if position(
    'naxa_phone_valid_for_country' in
    pg_get_functiondef('public.handle_new_user()'::regprocedure)
  ) = 0 then
    raise exception 'handle_new_user() ne délègue pas la validation au validateur corrigé';
  end if;
end;
$naxa073$;

select true as naxa_073_signup_phone_validation_pass;
rollback;
