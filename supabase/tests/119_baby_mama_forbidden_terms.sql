-- Test structurel et comportemental NAXA 119 ; rollback systématique.
begin;

create temporary table baby_mama_guard_test (
  universe_slug text,
  name text,
  brand text,
  category text,
  description text
) on commit drop;

create trigger baby_mama_guard_test_trigger
before insert or update of universe_slug, name, brand, category, description
on pg_temp.baby_mama_guard_test
for each row execute function public.guard_baby_mama_catalog_terms();

do $test$
declare
  forbidden_name text;
  forbidden_names text[] := array[
    'Lait infantile 1er âge',
    'LAITS INFANTILES 2e AGE',
    'Lait de croissance',
    'Préparation infantile',
    'Substitut du lait maternel',
    'Céréales infantiles',
    'Farines infantiles',
    'Biberons anti-colique',
    'Tétines silicone',
    'Sucette bébé',
    'Infant formula stage 1',
    'Follow-on formula',
    'Growing-up milk',
    'Baby cereals',
    'Infant feeding bottle',
    'Pacifiers'
  ];
begin
  foreach forbidden_name in array forbidden_names loop
    begin
      insert into pg_temp.baby_mama_guard_test(universe_slug, name, brand, category, description)
      values ('bebe-maman', forbidden_name, null, 'Test', null);
      raise exception 'Le terme interdit a été accepté : %', forbidden_name;
    exception
      when check_violation then
        -- Le garde-fou doit refuser l’enregistrement avec SQLSTATE 23514.
        null;
    end;
  end loop;

  -- Contrôle anti-faux-positif : les soins de toilette ne sont pas du lait infantile.
  insert into pg_temp.baby_mama_guard_test(universe_slug, name, brand, category, description)
  values ('bebe-maman', 'Lait de toilette bébé', null, 'Hygiène et soins', null);

  -- Le garde-fou spécifique Bébé & Maman ne doit pas bloquer un autre univers.
  insert into pg_temp.baby_mama_guard_test(universe_slug, name, brand, category, description)
  values ('parapharmacie', 'Infant formula (test de portée)', null, 'Autres', null);
end;
$test$;

select true as naxa_119_baby_mama_forbidden_terms_pass;
rollback;
