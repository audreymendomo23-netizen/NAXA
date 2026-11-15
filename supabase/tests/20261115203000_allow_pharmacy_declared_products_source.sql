do $test$
declare
  v_constraint text;
  v_trigger text;
  v_rpc text;
begin
  select pg_get_constraintdef(c.oid)
    into v_constraint
  from pg_constraint c
  where c.conrelid='public.produits'::regclass
    and c.conname='produits_source_fiche_check';

  if v_constraint is null
     or position('declaration_pharmacie' in v_constraint)=0 then
    raise exception 'La contrainte source_fiche doit accepter declaration_pharmacie';
  end if;

  v_trigger:=pg_get_functiondef('public.produits_garde_fiche()'::regprocedure);
  if position('new.source_fiche := ''declaration_pharmacie''' in v_trigger)=0 then
    raise exception 'Le déclencheur de déclaration doit utiliser la source dédiée pharmacie';
  end if;

  v_rpc:=pg_get_functiondef(
    'public.pharmacie_produit_declarer_et_reference_initialiser(uuid,text,text,text,text,integer,text,text,boolean)'::regprocedure
  );
  if position('declaration_pharmacie' in v_rpc)=0
     or position('public.gestionnaire_stock_reference_initialiser' in v_rpc)=0 then
    raise exception 'La RPC doit enregistrer la déclaration et initialiser la ligne stock';
  end if;
end
$test$;

select 'Pharmacy product source constraint accepts declaration_pharmacie; trigger/RPC source contract: PASS' as result;
