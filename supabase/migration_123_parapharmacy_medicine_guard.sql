-- NAXA 123 — les médicaments ne sont pas publiables dans l'univers Parapharmacie.
-- Additif : laisse l'univers Bébé & Maman distinct et préserve intégralement la Pharmacie historique.
begin;

create or replace function public.guard_parapharmacy_medicine_terms()
returns trigger
language plpgsql
set search_path = public, extensions, pg_temp
as $function$
declare
  normalized text;
  forbidden_pattern constant text :=
    '(^|[^a-z])(' ||
    'medicaments?|medicinal[[:space:]]+products?|pharmaceuticals?|drugs?|' ||
    'antibiotiques?|antipaludiques?|antitussifs?|antalgiques?|' ||
    'anti[[:space:]-]+inflammatoires?|antihistaminiques?|antipyretiques?|antidiarrheiques?|' ||
    'paracetamol|acetaminophen|ibuprofen|aspirine|amoxicilline|artemether|lumefantrine|' ||
    'quinine|metronidazole|diclofenac|omeprazole|cetirizine|loratadine|prednisolone|' ||
    'dexamethasone|tramadol|suppositoires?|sirop[[:space:]-]+medicamenteux|' ||
    'medicinal[[:space:]-]+syrup' ||
    ')([^a-z]|$)';
begin
  if new.universe_slug <> 'parapharmacie' then
    return new;
  end if;

  normalized := lower(unaccent(concat_ws(' ', new.name, new.brand, new.category, new.description)));

  if normalized ~ forbidden_pattern then
    raise exception 'Les médicaments ne sont pas autorisés dans le catalogue Parapharmacie'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

drop trigger if exists partner_products_parapharmacy_medicine_guard on public.partner_products;
create trigger partner_products_parapharmacy_medicine_guard
before insert or update of universe_slug, name, brand, category, description
on public.partner_products
for each row execute function public.guard_parapharmacy_medicine_terms();

commit;
