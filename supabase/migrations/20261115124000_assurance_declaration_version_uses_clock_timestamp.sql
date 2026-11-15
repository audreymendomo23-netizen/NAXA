-- A declaration correction must invalidate previous roster verification even inside one DB transaction.
begin;

create or replace function private.assurance_stamp_couverture_declaration()
returns trigger
language plpgsql
set search_path=''
as $function$
begin
  if old.numero_adherent is distinct from new.numero_adherent
     or old.numero_police is distinct from new.numero_police
     or old.date_debut is distinct from new.date_debut
     or old.date_fin is distinct from new.date_fin
     or old.assureur_id is distinct from new.assureur_id then
    new.declaration_maj_at:=clock_timestamp();
  end if;
  return new;
end;
$function$;

commit;
