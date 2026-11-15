begin;

do $test$
declare
  v_rls boolean;
  v_anon_policy record;
  v_auth_policy record;
  v_insert record;
  v_update record;
begin
  select relrowsecurity into v_rls from pg_class where oid='public.produits'::regclass;
  if v_rls is not true then raise exception 'RLS produits doit rester activée'; end if;

  select policyname,cmd,roles,qual into v_anon_policy from pg_policies
  where schemaname='public' and tablename='produits'
    and policyname='produits_public_live_offer_read';
  if not found or v_anon_policy.cmd<>'SELECT' or v_anon_policy.roles<>'{anon}'
     or position('marketplace_produit_visible' in v_anon_policy.qual)=0 then
    raise exception 'Lecture anon doit dépendre d''une offre pharmacie réelle';
  end if;

  select policyname,cmd,roles,qual into v_auth_policy from pg_policies
  where schemaname='public' and tablename='produits'
    and policyname='produits_authenticated_live_offer_read';
  if not found or v_auth_policy.cmd<>'SELECT' or v_auth_policy.roles<>'{authenticated}'
     or position('marketplace_produit_visible' in v_auth_policy.qual)=0
     or position('is_admin' in v_auth_policy.qual)=0
     or position('my_pharmacie' in v_auth_policy.qual)=0 then
    raise exception 'Lecture authenticated doit préserver offres, Admin et catalogue interne pharmacie';
  end if;

  select policyname,cmd,roles,with_check into v_insert from pg_policies
  where schemaname='public' and tablename='produits' and policyname='produits_write';
  if not found or v_insert.cmd<>'INSERT' or v_insert.roles<>'{authenticated}'
     or position('created_by_pharmacie_id' in v_insert.with_check)=0
     or position('fiche_validee' in v_insert.with_check)=0 then
    raise exception 'INSERT doit être limité à une déclaration de la pharmacie active, sans validation';
  end if;

  select policyname,cmd,roles,qual,with_check into v_update from pg_policies
  where schemaname='public' and tablename='produits' and policyname='produits_update';
  if not found or v_update.cmd<>'UPDATE' or v_update.roles<>'{authenticated}'
     or position('created_by_pharmacie_id' in v_update.qual)=0
     or position('created_by_pharmacie_id' in v_update.with_check)=0 then
    raise exception 'UPDATE doit être limité aux déclarations de la pharmacie propriétaire';
  end if;

  if has_function_privilege('anon','public.marketplace_produit_visible(uuid)','EXECUTE') is not true
     or has_function_privilege('authenticated','public.marketplace_produit_visible(uuid)','EXECUTE') is not true then
    raise exception 'La fonction de visibilité doit être exécutable pour la policy RLS';
  end if;

  if has_function_privilege('anon','private.marketplace_offre_stock_disponible_guarded(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','private.marketplace_offre_stock_disponible_guarded(uuid,uuid)','EXECUTE') then
    raise exception 'Le helper stock interne ne doit pas être exposé directement';
  end if;

  if position('fiche_validee' in pg_get_functiondef('private.marketplace_offre_stock_disponible_guarded(uuid,uuid)'::regprocedure))>0
     or position('fiche_validee' in pg_get_functiondef('private.search_pharmacies(text[],double precision,double precision,double precision)'::regprocedure))>0
     or position('fiche_validee' in pg_get_functiondef('private.search_pharmacies_bulk(text[],integer[],double precision,double precision,double precision)'::regprocedure))>0 then
    raise exception 'Un verrou NAXA de validation subsiste dans le moteur Marketplace';
  end if;
end
$test$;

-- Current Replay test pharmacies are demo-only. Their test stocks must remain
-- invisible even after the fiche-validation gate is removed.
set local role anon;
do $anon_test$
begin
  if exists (select 1 from public.produits) then
    raise exception 'Aucune fiche ne doit être publique via les seules pharmacies démo';
  end if;
end
$anon_test$;

rollback;

select 'Pharmacy-led product declaration and publication: fiche validation removed; public visibility follows a live pharmacy offer; RLS creator scope preserved: PASS' as result;
