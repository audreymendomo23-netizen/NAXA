-- Test ciblé NAXA 123 : bloque les médicaments en Parapharmacie sans bloquer les autres univers.
-- À exécuter uniquement sur une base de test où la migration 123 est appliquée.
begin;

create temporary table parapharmacy_medicine_guard_test (
  universe_slug text,
  name text,
  brand text,
  category text,
  description text
) on commit drop;

create trigger parapharmacy_medicine_guard_test_trigger
before insert or update of universe_slug, name, brand, category, description
on pg_temp.parapharmacy_medicine_guard_test
for each row execute function public.guard_parapharmacy_medicine_terms();

do $test$
declare
  forbidden_name text;
  forbidden_names text[] := array[
    'Médicament',
    'Paracétamol 500 mg',
    'Doliprane bébé',
    'Coartem',
    'Aspirin',
    'Ibuprofène',
    'Amoxicilline',
    'Ibuprofen syrup',
    'Antibiotique',
    'Antipaludique',
    'Anti-inflammatoire',
    'Suppositoire médicamenteux'
  ];
begin
  foreach forbidden_name in array forbidden_names loop
    begin
      insert into pg_temp.parapharmacy_medicine_guard_test(universe_slug, name, brand, category, description)
      values ('parapharmacie', forbidden_name, null, 'Bien-être', null);
      raise exception 'Un produit médicamenteux a été accepté : %', forbidden_name;
    exception
      when check_violation then
        null;
    end;
  end loop;

  -- Les produits cosmétiques de parapharmacie restent autorisés.
  insert into pg_temp.parapharmacy_medicine_guard_test(universe_slug, name, brand, category, description)
  values ('parapharmacie', 'Crème hydratante', null, 'Soin du visage', 'Hydratation quotidienne');

  -- La règle est strictement limitée à Parapharmacie : un produit médical bébé peut rester référencé,
  -- mais l'interface client masque sa description/posologie et affiche l'avertissement pharmacien.
  insert into pg_temp.parapharmacy_medicine_guard_test(universe_slug, name, brand, category, description)
  values ('bebe-maman', 'Paracétamol bébé', null, 'Médicament', 'Ne pas afficher cette posologie au client');
end;
$test$;

select true as naxa_123_parapharmacy_medicine_guard_pass;
rollback;
