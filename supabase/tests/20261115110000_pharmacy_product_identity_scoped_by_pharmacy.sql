-- Contract test: pharmacy-owned product identities remain independent.
do $test$
declare
  v_rpc text;
  v_initializer text;
  v_trigger text;
  v_policy record;
  v_search text;
  v_bulk text;
  v_popular text;
  v_identity_index text;
  v_barcode_index text;
begin
  if exists (
    select 1 from pg_constraint
    where conrelid='public.produits'::regclass
      and conname='produits_nom_dosage_forme_key'
  ) then
    raise exception 'L''unicité globale nom/dosage/forme doit être supprimée';
  end if;

  if to_regclass('public.produits_code_barre_uq') is not null then
    raise exception 'L''unicité globale du code-barres doit être supprimée';
  end if;

  select indexdef into v_identity_index
  from pg_indexes
  where schemaname='public' and tablename='produits'
    and indexname='produits_pharmacy_identity_uq';
  if v_identity_index is null
     or position('created_by_pharmacie_id' in v_identity_index)=0
     or position('UNIQUE' in upper(v_identity_index))=0 then
    raise exception 'Index d''identité unique et propre à chaque pharmacie absent';
  end if;

  select indexdef into v_barcode_index
  from pg_indexes
  where schemaname='public' and tablename='produits'
    and indexname='produits_pharmacy_barcode_uq';
  if v_barcode_index is null
     or position('created_by_pharmacie_id' in v_barcode_index)=0
     or position('UNIQUE' in upper(v_barcode_index))=0 then
    raise exception 'Index code-barres unique et propre à chaque pharmacie absent';
  end if;

  v_rpc:=pg_get_functiondef(
    'public.pharmacie_produit_declarer_et_reference_initialiser(uuid,text,text,text,text,integer,text,text,boolean)'::regprocedure
  );
  if position('p.created_by_pharmacie_id=p_pharmacie' in v_rpc)=0
     or position('pg_advisory_xact_lock' in v_rpc)=0
     or position('naxa-product-barcode:' in v_rpc)=0
     or position('Ce code-barres est déjà utilisé par une autre fiche de votre pharmacie' in v_rpc)=0
     or position('public.gestionnaire_stock_reference_initialiser' in v_rpc)=0 then
    raise exception 'La RPC doit réutiliser exclusivement la fiche de la pharmacie cible et sérialiser identité/code-barres';
  end if;

  v_initializer:=pg_get_functiondef(
    'public.gestionnaire_stock_reference_initialiser(uuid,uuid,integer,text)'::regprocedure
  );
  if position('created_by_pharmacie_id' in v_initializer)=0
     or position('v_owner is not null and v_owner is distinct from p_pharmacie' in v_initializer)=0
     or position('Administrateur : consultation uniquement' in v_initializer)=0 then
    raise exception 'L''initialisation de stock doit refuser une fiche appartenant à une autre pharmacie et l''Admin';
  end if;

  v_trigger:=pg_get_functiondef('public.produits_garde_fiche()'::regprocedure);
  if position('public.is_admin()' in v_trigger)>0
     or position('promoteur' in v_trigger)=0
     or position('new.created_by_pharmacie_id := v_pharmacie' in v_trigger)=0 then
    raise exception 'Le déclencheur ne doit pas contourner la propriété pharmacie pour Admin';
  end if;

  select policyname,qual,with_check into v_policy
  from pg_policies
  where schemaname='public' and tablename='produits'
    and policyname='produits_write';
  if not found or position('is_admin' in coalesce(v_policy.with_check,''))>0
     or position('naxa_scope_allows' in coalesce(v_policy.with_check,''))=0 then
    raise exception 'INSERT produit doit être réservé à la pharmacie déclarante, sans exception Admin';
  end if;

  select policyname,qual,with_check into v_policy
  from pg_policies
  where schemaname='public' and tablename='produits'
    and policyname='produits_update';
  if not found or position('is_admin' in coalesce(v_policy.qual,''))>0
     or position('is_admin' in coalesce(v_policy.with_check,''))>0
     or position('naxa_scope_allows' in coalesce(v_policy.qual,''))=0
     or position('naxa_scope_allows' in coalesce(v_policy.with_check,''))=0 then
    raise exception 'UPDATE produit doit rester limité à la pharmacie propriétaire';
  end if;

  select qual into v_policy
  from pg_policies
  where schemaname='public' and tablename='produits'
    and policyname='produits_authenticated_live_offer_read';
  if not found or position('is_admin' in coalesce(v_policy.qual,''))=0 then
    raise exception 'La consultation technique en lecture seule Admin doit rester possible';
  end if;

  v_search:=lower(pg_get_functiondef(
    'private.search_pharmacies(text[],double precision,double precision,double precision)'::regprocedure
  ));
  v_bulk:=lower(pg_get_functiondef(
    'private.search_pharmacies_bulk(text[],integer[],double precision,double precision,double precision)'::regprocedure
  ));
  v_popular:=lower(pg_get_functiondef('private.produits_populaires(integer,integer)'::regprocedure));

  if position('partition by t.n,s.pharmacie_id' in v_search)=0
     or position('group by pharmacie_id' in v_search)=0 then
    raise exception 'La recherche simple doit classer et agréger les fiches séparément par pharmacie';
  end if;
  if position('partition by t.n,s.pharmacie_id' in v_bulk)=0
     or position('group by b.pharmacie_id,b.produit_id' in v_bulk)=0
     or position('group by d.pharmacie_id' in v_bulk)=0 then
    raise exception 'La recherche groupée doit conserver les fiches/offres propres à chaque pharmacie';
  end if;
  if position('group by p.id' in v_popular)=0 then
    raise exception 'Les fiches populaires doivent garder leur identité indépendante';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.pharmacie_produit_declarer_et_reference_initialiser(uuid,text,text,text,text,integer,text,text,boolean)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.pharmacie_produit_declarer_et_reference_initialiser(uuid,text,text,text,text,integer,text,text,boolean)',
    'EXECUTE'
  ) then
    raise exception 'La RPC de déclaration doit être disponible uniquement aux rôles authentifiés autorisés';
  end if;
end
$test$;

select 'Per-pharmacy product identity, barcode scope, pharmacy-owned stock initialization, Admin read-only boundary and per-pharmacy search aggregation: PASS' as result;
