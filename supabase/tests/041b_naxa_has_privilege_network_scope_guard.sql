-- Garde la restriction réseau pour tout appel qui cible explicitement une pharmacie.
do $$
declare
  definition text := pg_get_functiondef('private.naxa_has_privilege(text,uuid,text)'::regprocedure);
begin
  if position('public.naxa_scope_allows(uid, p_pharmacie, ''RESEAU'')' in definition)=0
     and position('public.naxa_scope_allows(uid,p_pharmacie,''RESEAU'')' in definition)=0 then
    raise exception 'naxa_has_privilege ne borne pas la pharmacie cible au réseau Promoteur';
  end if;
end
$$;

select '041b_naxa_has_privilege_network_scope_guard PASS' as resultat;
