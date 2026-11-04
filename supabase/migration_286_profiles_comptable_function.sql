-- NAXA — keep the Comptable business function representable on profiles.
-- The assignment and privilege catalog already support 'comptable';
-- this aligns the profile CHECK constraint with that existing contract.
begin;

alter table public.profiles
  drop constraint if exists profiles_fonction_interne_check;

alter table public.profiles
  add constraint profiles_fonction_interne_check
  check (fonction_interne is null or fonction_interne in (
    'promoteur',
    'responsable',
    'caisse',
    'manager_regional',
    'chef_agence',
    'custom',
    'pharmacien',
    'pharmacien_assistant',
    'gestionnaire_stock',
    'magasinier',
    'comptable'
  ));

commit;
