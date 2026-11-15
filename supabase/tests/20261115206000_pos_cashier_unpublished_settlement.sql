-- Structural and runtime contract for POS use by an active unpublished pharmacy.
begin;

do $test$
declare
  v_actor text;
  v_settlement text;
begin
  v_actor := pg_get_functiondef(
    'public.naxa_caisse_actor_for_pharmacy(uuid)'::regprocedure
  );
  if v_actor ilike '%visible_recherche%'
     or v_actor not ilike '%ph.actif=true%'
     or v_actor not ilike '%ph.archivee_le is null%'
     or v_actor not ilike '%private.naxa_scope_allows%'
     or v_actor not ilike '%can_operate_pharmacy%' then
    raise exception 'Le garde du poste Caisse doit valider identité/scope/activité, pas la publication publique';
  end if;

  v_settlement := pg_get_functiondef(
    'public.vente_encaisser_finaliser(uuid,integer)'::regprocedure
  );
  if v_settlement ilike '%visible_recherche%'
     or v_settlement not ilike '%ph.actif=true%'
     or v_settlement not ilike '%ph.archivee_le is null%'
     or v_settlement not ilike '%can_operate_pharmacy%' then
    raise exception 'Le finaliseur doit maintenir les droits et l''activité sans exiger la visibilité Marketplace';
  end if;
end
$test$;

rollback;
select 'Cashier authorization and final settlement are independent of Marketplace publication: PASS' as result;
