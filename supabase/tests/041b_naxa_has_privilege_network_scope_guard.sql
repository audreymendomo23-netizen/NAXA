-- Garde le contrôle réseau dans le moteur privé, avec la pharmacie de contrôle normalisée.
do $$
declare
  definition text := lower(pg_get_functiondef('private.naxa_has_privilege(text,uuid,text)'::regprocedure));
begin
  if position('if p_scope=''reseau''' in definition)=0 then
    raise exception 'naxa_has_privilege doit traiter explicitement le scope RESEAU';
  end if;
  if position('public.naxa_scope_allows(uid,target_pharmacy,p_scope)' in definition)=0
     and position('public.naxa_scope_allows(uid, target_pharmacy, p_scope)' in definition)=0 then
    raise exception 'naxa_has_privilege doit contrôler le scope via la pharmacie normalisée';
  end if;
  if position('pp.pharmacie_id=target_pharmacy' in definition)=0 then
    raise exception 'naxa_has_privilege doit borner le réseau aux pharmacies associées';
  end if;
end
$$;

select '041b_naxa_has_privilege_network_scope_guard PASS' as resultat;
