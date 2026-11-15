do $test$
declare
  v_def text;
  v_acl boolean;
  v_helper text;
  v_trigger text;
begin
  v_def:=pg_get_functiondef(
    'public.pharmacie_produit_declarer_et_reference_initialiser(uuid,text,text,text,text,integer,text,text,boolean)'::regprocedure
  );

  if position('auth.uid()' in v_def)=0
     or position('public.my_pharmacie()' in v_def)=0
     or position('private.naxa_business_function' in v_def)=0
     or position('public.gestionnaire_stock_reference_initialiser' in v_def)=0
     or position('declaration_pharmacie' in v_def)=0 then
    raise exception 'RPC declaration doit exiger une session, un rôle actif, la pharmacie sélectionnée et l''initialisation stock gardée';
  end if;

  if has_function_privilege('anon',
      'public.pharmacie_produit_declarer_et_reference_initialiser(uuid,text,text,text,text,integer,text,text,boolean)','EXECUTE')
     or not has_function_privilege('authenticated',
      'public.pharmacie_produit_declarer_et_reference_initialiser(uuid,text,text,text,text,integer,text,text,boolean)','EXECUTE') then
    raise exception 'RPC déclaration accessible uniquement à authenticated/service_role';
  end if;

  v_helper:=pg_get_functiondef('public.gestionnaire_stock_reference_initialiser(uuid,uuid,integer,text)'::regprocedure);
  if position('values(p_pharmacie,p_produit,p_prix,0' in lower(v_helper))=0 then
    raise exception 'La référence initialisée doit commencer à quantité zéro';
  end if;

  v_trigger:=pg_get_functiondef('public.produits_garde_fiche()'::regprocedure);
  if position('new.created_by := auth.uid()' in v_trigger)=0
     or position('new.created_by_pharmacie_id := public.my_pharmacie()' in v_trigger)=0
     or position('new.source_fiche := ''declaration_pharmacie''' in v_trigger)=0
     or position('new.fiche_validee := false' in v_trigger)=0 then
    raise exception 'Le déclencheur doit identifier le créateur et la pharmacie, sans validation NAXA';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname='public' and tablename in ('produits','stocks')
      and cmd='INSERT' and roles::text like '%anon%'
  ) then
    raise exception 'Le rôle anon ne doit recevoir aucune policy INSERT sur produits/stocks';
  end if;
end
$test$;

select 'Pharmacy product declaration RPC: authenticated active pharmacy scope, creator attribution, no NAXA approval, stock reference quantity zero: PASS' as result;
