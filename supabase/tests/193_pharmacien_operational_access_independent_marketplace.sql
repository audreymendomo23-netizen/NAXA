-- NAXA 193 — l'accès interne Pharmacien ne doit pas dépendre de visible_recherche.
do $test$
declare
  v_service text := pg_get_functiondef('public.pharmacien_service_demarrer(text)'::regprocedure);
  v_export text := pg_get_functiondef('public.pharmacien_journaliser_export(text,integer)'::regprocedure);
begin
  if position('visible_recherche' in lower(v_service)) > 0 then
    raise exception 'NAXA 193: la prise de service dépend encore de la publication Marketplace';
  end if;
  if position('visible_recherche' in lower(v_export)) > 0 then
    raise exception 'NAXA 193: l’export Pharmacien dépend encore de la publication Marketplace';
  end if;
  if position('f.actif = true' in lower(v_service)) = 0
     or position('f.actif=true' in lower(v_export)) = 0 then
    raise exception 'NAXA 193: le contrôle d’activité de la pharmacie doit être conservé';
  end if;
end;
$test$;
select true as naxa_193_pharmacien_operational_access_pass;
