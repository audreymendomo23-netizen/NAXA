-- NAXA 082 — vérifie les préfixes internationaux littéraux du validateur téléphone.
begin;

do $naxa082$
declare
  r record;
begin
  for r in
    select * from (values
      ('CM', '+237612345678', true),
      ('CM', '+23761234567', false),
      ('CF', '+23670123456', true),
      ('TD', '+23566123456', true),
      ('CG', '+242061234567', true),
      ('CD', '+243991234567', true),
      ('GQ', '+240222123456', true),
      ('GA', '+24106123456', true),
      ('ST', '+2399912345', true),
      ('AO', '+244921234567', true),
      ('BI', '+25779123456', true),
      ('RW', '+250781234567', true),
      ('ZZ', '+999123456789', false)
    ) as cases(country, phone, expected)
  loop
    if private.naxa_phone_valid_for_country(r.country, r.phone) is distinct from r.expected then
      raise exception 'Échec NAXA 082 : pays %, numéro %, attendu %, obtenu %',
        r.country, r.phone, r.expected,
        private.naxa_phone_valid_for_country(r.country, r.phone);
    end if;
  end loop;
end;
$naxa082$;

select true as naxa_082_phone_regex_literal_plus_pass;
rollback;
