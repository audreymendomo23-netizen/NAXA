-- Recette Replay : ACL et mutation du stock, puis rollback intégral.
begin;

do $acl$
begin
  if has_function_privilege('anon', 'public.naxa_import_stock_batch(uuid,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.naxa_import_stock_batch(uuid,jsonb)', 'EXECUTE') then
    raise exception 'La RPC legacy reste exécutable directement par anon/authenticated';
  end if;
  if has_function_privilege('anon', 'public.naxa_import_stock_batch_as_actor(uuid,uuid,jsonb)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.naxa_import_stock_batch_as_actor(uuid,uuid,jsonb)', 'EXECUTE') then
    raise exception 'La RPC serveur est exposée à anon/authenticated';
  end if;
  if not has_function_privilege('service_role', 'public.naxa_import_stock_batch_as_actor(uuid,uuid,jsonb)', 'EXECUTE') then
    raise exception 'service_role ne peut pas appeler la RPC serveur';
  end if;
end;
$acl$;

set local role service_role;
select pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);
select pg_catalog.set_config('request.jwt.claims', '{"role":"service_role"}', true);

do $e2e$
declare
  v_actor uuid;
  v_pharmacie uuid;
  v_produit uuid;
  v_nom text;
  v_quantite integer;
  v_prix integer;
  v_result jsonb;
  v_after integer;
begin
  select id into v_actor
  from public.profiles
  where actif = true and role::text = 'admin'
  order by created_at desc
  limit 1;
  if v_actor is null then raise exception 'Fixture admin Replay absente'; end if;

  select id into v_pharmacie
  from public.pharmacies
  where nom like 'NAXA TEST%Pharmacie Bastos%'
    and actif = true and archivee_le is null
  order by nom
  limit 1;
  if v_pharmacie is null then raise exception 'Fixture pharmacie Replay absente'; end if;

  select s.produit_id,p.nom,s.quantite,s.prix
  into v_produit,v_nom,v_quantite,v_prix
  from public.stocks s
  join public.produits p on p.id=s.produit_id
  where s.pharmacie_id=v_pharmacie
    and s.prix is not null
    and not exists (
      select 1 from public.stocks_lots l
      where l.pharmacie_id=s.pharmacie_id and l.produit_id=s.produit_id
    )
  order by p.nom
  limit 1;
  if v_produit is null then raise exception 'Fixture stock sans lot Replay absente'; end if;

  v_result := public.naxa_import_stock_batch_as_actor(
    v_actor,
    v_pharmacie,
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'produit_id',v_produit,'nom',v_nom,'quantite',v_quantite+1,'prix',v_prix
    ))
  );
  if coalesce(v_result->>'ok','false') <> 'true' then
    raise exception 'Import RPC E2E non confirmé : %',v_result;
  end if;

  select quantite into v_after
  from public.stocks
  where pharmacie_id=v_pharmacie and produit_id=v_produit;
  if v_after <> v_quantite+1 then
    raise exception 'Quantité importée inattendue : attendu %, obtenu %',v_quantite+1,v_after;
  end if;
end;
$e2e$;

rollback;
select 'stock_import_rpc_service_role_guard E2E PASS (rollback confirmé)' as resultat;
