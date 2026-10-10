-- Vérifie que le seed ERP-006 a renseigné les champs canoniques du catalogue.
do $$
declare
  v_code text;
begin
  foreach v_code in array array['VIEW_PRESCRIPTION','EDIT_PRESCRIPTION','VALIDATE_PRESCRIPTION']
  loop
    if not exists (
      select 1 from public.naxa_privileges n
      where n.code=v_code
        and n.family='SANTE'
        and n.famille='SANTE'
        and n.description is not null
        and n.libelle is not null
        and n.niveau_min=1
        and n.niveau_max=3
        and n.delegable=false
        and n.governance_only=false
        and n.governance=false
        and n.active=true
    ) then
      raise exception 'Privilège de prescription % absent ou incomplet',v_code;
    end if;
  end loop;
end
$$;

select '044b_prescription_privilege_seed_compat PASS' as resultat;
