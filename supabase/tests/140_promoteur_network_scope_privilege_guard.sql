-- NAXA 140 — régression du contrôle de scope réseau.
do $test$
declare
  v_definition text := lower(pg_get_functiondef('private.naxa_has_privilege(text,uuid,text)'::regprocedure));
begin
  if position('if p_scope=''reseau''' in v_definition)=0 then
    raise exception '140.1 : branche RESEAU absente';
  end if;
  if position('not public.naxa_scope_allows(uid,target_pharmacy,''reseau'')' in v_definition)=0
     and position('not public.naxa_scope_allows(uid, target_pharmacy, ''reseau'')' in v_definition)=0 then
    raise exception '140.2 : la pharmacie demandée doit appartenir au réseau Promoteur';
  end if;
  if position('pp.pharmacie_id is null' in v_definition)=0
     or position('pp.scope_type=''reseau''' in v_definition)=0 then
    raise exception '140.3 : l’attribution réseau doit être la ligne canonique sans pharmacie';
  end if;
end
$test$;
select 'Vérification 140 — scope réseau borné : PASS' as resultat;
