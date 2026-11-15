do $test$
declare
  v_trigger text;
  v_visible text;
  v_insert record;
  v_update record;
  v_auth_select record;
begin
  v_trigger:=pg_get_functiondef('public.produits_garde_fiche()'::regprocedure);
  if position('naxa.product_declaration_pharmacy' in v_trigger)=0
     or position('private.naxa_scope_allows' in v_trigger)=0
     or position('promoteur' in v_trigger)=0
     or position('new.created_by_pharmacie_id := v_pharmacie' in v_trigger)=0 then
    raise exception 'Le déclencheur doit permettre Promoteur scoped et enregistrer sa pharmacie cible';
  end if;

  v_visible:=pg_get_functiondef('public.marketplace_produit_visible(uuid)'::regprocedure);
  if position('public.stocks' in v_visible)=0
     or position('ph.actif is true' in v_visible)=0
     or position('ph.visible_recherche is true' in v_visible)=0
     or position('ph.est_demo is false' in v_visible)=0
     or position('offer.quantite>0' in v_visible)>0 then
    raise exception 'Une fiche doit être consultable avec un lien pharmacie réel même lorsque le stock est nul';
  end if;

  select policyname,cmd,roles,qual into v_auth_select from pg_policies
  where schemaname='public' and tablename='produits'
    and policyname='produits_authenticated_live_offer_read';
  if not found or position('naxa_promoteur_valide' in v_auth_select.qual)=0 then
    raise exception 'La consultation du catalogue interne doit rester possible au Promoteur validé';
  end if;

  select policyname,cmd,roles,with_check into v_insert from pg_policies
  where schemaname='public' and tablename='produits' and policyname='produits_write';
  if not found or position('naxa_scope_allows' in v_insert.with_check)=0
     or position('promoteur' in v_insert.with_check)=0 then
    raise exception 'INSERT doit autoriser seulement le périmètre pharmacie du Promoteur et du personnel habilité';
  end if;

  select policyname,cmd,roles,qual,with_check into v_update from pg_policies
  where schemaname='public' and tablename='produits' and policyname='produits_update';
  if not found or position('naxa_scope_allows' in v_update.qual)=0
     or position('naxa_scope_allows' in v_update.with_check)=0 then
    raise exception 'UPDATE doit rester borné à la pharmacie déclarante';
  end if;

  if position('fiche_validee' in pg_get_functiondef('private.marketplace_offre_stock_disponible_guarded(uuid,uuid)'::regprocedure))>0
     or position('fiche_validee' in pg_get_functiondef('private.search_pharmacies(text[],double precision,double precision,double precision)'::regprocedure))>0
     or position('fiche_validee' in pg_get_functiondef('private.search_pharmacies_bulk(text[],integer[],double precision,double precision,double precision)'::regprocedure))>0 then
    raise exception 'Un verrou de validation NAXA subsiste dans la recherche ou les offres';
  end if;
end
$test$;

select 'Promoteur network-scoped declaration + public discoverability at zero stock: PASS' as result;
