-- NAXA 044b — compatibilité du seed ERP-006 avec le catalogue double-nommage.
-- migration_020 maintient les colonnes historiques family/description/governance_only
-- et les colonnes canoniques famille/libelle/niveau_min/niveau_max/governance/active.
-- migration_045 insère seulement les colonnes historiques ; compléter les champs canoniques
-- pour les trois privilèges de prescription sans modifier la migration existante.
create or replace function public.naxa_prescription_privilege_seed_compat()
returns trigger
language plpgsql
set search_path=''
as $fn$
begin
  if new.code in ('VIEW_PRESCRIPTION','EDIT_PRESCRIPTION','VALIDATE_PRESCRIPTION') then
    new.famille := coalesce(new.famille,new.family,'SANTE');
    new.libelle := coalesce(new.libelle,new.description,new.code);
    new.niveau_min := coalesce(new.niveau_min,1);
    new.niveau_max := coalesce(new.niveau_max,3);
    new.governance := coalesce(new.governance,new.governance_only,false);
    new.active := coalesce(new.active,true);
  end if;
  return new;
end
$fn$;

drop trigger if exists trg_naxa_prescription_privilege_seed_compat on public.naxa_privileges;
create trigger trg_naxa_prescription_privilege_seed_compat
before insert on public.naxa_privileges
for each row execute function public.naxa_prescription_privilege_seed_compat();
