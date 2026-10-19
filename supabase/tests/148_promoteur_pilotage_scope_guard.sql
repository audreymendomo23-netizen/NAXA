-- NAXA 148 — garde de périmètre du Pilotage Promoteur.
-- Contrôle la définition installée sans modifier les données métier.
do $test$
declare
  d text := lower(pg_get_functiondef('private.stats_pilotage_scope(integer)'::regprocedure));
begin
  if position('naxa_has_privilege(''view_network_pilotage'',null,''reseau'')' in d)=0 then
    raise exception '148.1 : le Pilotage Promoteur doit exiger le privilège réseau';
  end if;
  if position('pp.promoteur_id=uid and pp.actif=true' in d)=0 then
    raise exception '148.2 : les pharmacies doivent provenir des liens Promoteur actifs';
  end if;
  if position('e.pharmacie_id=any(v_pharmacies)' in d)=0 then
    raise exception '148.3 : les événements doivent être filtrés par le périmètre autorisé';
  end if;
  if position('ph.est_demo is not true' in d)=0 then
    raise exception '148.4 : les données de démonstration doivent être exclues';
  end if;
end
$test$;
select 'Vérification 148 — périmètre Pilotage Promoteur : PASS' as resultat;
