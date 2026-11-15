-- POS private workspace: final cash settlement must not require Marketplace publication.
begin;

do $fix$
declare
  v_signature regprocedure;
  v_definition text;
  v_before text;
begin
  v_signature := 'public.naxa_caisse_actor_for_pharmacy(uuid)'::regprocedure;
  v_definition := pg_get_functiondef(v_signature);
  v_before := v_definition;
  v_definition := replace(
    v_definition,
    'and ph.actif=true and ph.visible_recherche=true',
    'and ph.actif=true and ph.archivee_le is null'
  );
  if v_definition <> v_before then
    execute v_definition;
  elsif v_definition ilike '%visible_recherche%'
     or v_definition not ilike '%ph.archivee_le is null%'
     or v_definition not ilike '%private.naxa_scope_allows%'
     or v_definition not ilike '%can_operate_pharmacy%' then
    raise exception 'Garde Caisse inattendu : identité et périmètre pharmacie doivent rester vérifiés';
  end if;

  v_signature := 'public.vente_encaisser_finaliser(uuid,integer)'::regprocedure;
  v_definition := pg_get_functiondef(v_signature);
  v_before := v_definition;
  v_definition := replace(
    v_definition,
    'and ph.visible_recherche=true',
    'and ph.archivee_le is null'
  );
  if v_definition <> v_before then
    execute v_definition;
  elsif v_definition ilike '%visible_recherche%'
     or v_definition not ilike '%ph.actif=true%'
     or v_definition not ilike '%ph.archivee_le is null%'
     or v_definition not ilike '%can_operate_pharmacy%' then
    raise exception 'Garde encaissement inattendu : activité, non-archivage et droits doivent rester vérifiés';
  end if;
end
$fix$;

commit;
