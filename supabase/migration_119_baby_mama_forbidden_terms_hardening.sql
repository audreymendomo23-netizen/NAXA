-- NAXA 119 — durcissement des exclusions Bébé & Maman.
-- Additif : renforce uniquement le garde-fou du catalogue, sans modifier le parcours Pharmacie.
begin;

create or replace function public.guard_baby_mama_catalog_terms()
returns trigger
language plpgsql
set search_path = public, extensions
as $function$
declare
  normalized text;
  forbidden_pattern constant text :=
    '(^|[^a-z])(' ||
    'laits?[[:space:]-]+infantiles?|' ||
    'laits?[[:space:]-]+(1er|premier|2e|deuxieme|second)[[:space:]-]+age|' ||
    'laits?[[:space:]-]+de[[:space:]-]+croissance|' ||
    'preparations?[[:space:]-]+infantiles?|' ||
    'substituts?[[:space:]-]+du[[:space:]-]+lait[[:space:]-]+maternel|' ||
    'cereales?[[:space:]-]+infantiles?|' ||
    'farines?[[:space:]-]+infantiles?|' ||
    'biberons?|' ||
    'tetines?|' ||
    'sucettes?|' ||
    'infant[[:space:]-]+formulas?|' ||
    'follow[[:space:]-]+on[[:space:]-]+formulas?|' ||
    'growing[[:space:]-]+up[[:space:]-]+milks?|' ||
    'baby[[:space:]-]+milks?|' ||
    'infant[[:space:]-]+cereals?|' ||
    'baby[[:space:]-]+cereals?|' ||
    'infant[[:space:]-]+flours?|' ||
    'feeding[[:space:]-]+bottles?|' ||
    'bottles?|' ||
    'teats?|' ||
    'pacifiers?|' ||
    'dummies?' ||
    ')([^a-z]|$)';
begin
  if new.universe_slug <> 'bebe-maman' then
    return new;
  end if;

  -- unaccent réduit les contournements par accents ; les espaces et tirets sont normalisés par la regex.
  normalized := lower(unaccent(concat_ws(' ', new.name, new.brand, new.category, new.description)));

  if normalized ~ forbidden_pattern then
    raise exception 'Ce produit n’est pas autorisé dans le catalogue Bébé & Maman'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

-- Réaffirme le déclencheur sur les champs qui déterminent l’éligibilité.
drop trigger if exists partner_products_baby_terms_guard on public.partner_products;
create trigger partner_products_baby_terms_guard
before insert or update of universe_slug, name, brand, category, description
on public.partner_products
for each row execute function public.guard_baby_mama_catalog_terms();

commit;
