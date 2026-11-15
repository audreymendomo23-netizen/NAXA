-- Public offer is a narrow, guarded RPC. Unvalidated pharmacy-owned products may be
-- offered by a real public pharmacy; demo/hidden/archived pharmacies remain invisible.
begin;

do $test$
declare
  v_public record;
  v_product uuid;
  v_pharmacy uuid;
  v_live_product uuid;
  v_live_pharmacy uuid;
begin
  select p.prosecdef,p.proconfig
    into v_public
  from pg_proc p
  where p.oid='public.marketplace_offre_stock_disponible(uuid,uuid)'::regprocedure;
  if not found or v_public.prosecdef is not true
     or v_public.proconfig::text not like '%search_path=%' then
    raise exception 'Le wrapper public doit rester SECURITY DEFINER avec search_path explicite';
  end if;

  if has_function_privilege('anon','private.marketplace_offre_stock_disponible_guarded(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','private.marketplace_offre_stock_disponible_guarded(uuid,uuid)','EXECUTE') then
    raise exception 'Le helper Marketplace interne ne doit pas être directement exécutable via les rôles API';
  end if;

  if not has_function_privilege('anon','public.marketplace_offre_stock_disponible(uuid,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.marketplace_offre_stock_disponible(uuid,uuid)','EXECUTE') then
    raise exception 'Le point d''entrée public Marketplace doit rester exécutable';
  end if;

  select p.id,s.pharmacie_id into v_live_product,v_live_pharmacy
  from public.produits p
  join public.stocks s on s.produit_id=p.id
  join public.pharmacies ph on ph.id=s.pharmacie_id
  cross join lateral public.marketplace_offre_stock_disponible(s.pharmacie_id,s.produit_id) offer
  where p.fiche_validee is not true
    and ph.actif is true and ph.visible_recherche is true
    and ph.est_demo is false and ph.archivee_le is null
    and offer.quantite>0
  limit 1;

  select p.id,s.pharmacie_id into v_product,v_pharmacy
  from public.produits p
  join public.stocks s on s.produit_id=p.id
  join public.pharmacies ph on ph.id=s.pharmacie_id
  where p.fiche_validee is not true
    and (ph.est_demo is true or ph.archivee_le is not null or ph.visible_recherche is not true)
  limit 1;

  if v_product is null and v_live_product is null then
    raise exception 'Fixture fiche pharmacie non validée avec stock attendue';
  end if;

  perform set_config('naxa_test.hidden_product',coalesce(v_product::text,''),true);
  perform set_config('naxa_test.hidden_pharmacy',coalesce(v_pharmacy::text,''),true);
  perform set_config('naxa_test.live_product',coalesce(v_live_product::text,''),true);
  perform set_config('naxa_test.live_pharmacy',coalesce(v_live_pharmacy::text,''),true);
end
$test$;

set local role anon;
do $anon_test$
declare
  v_product text:=current_setting('naxa_test.hidden_product',true);
  v_pharmacy text:=current_setting('naxa_test.hidden_pharmacy',true);
  v_live_product text:=current_setting('naxa_test.live_product',true);
  v_live_pharmacy text:=current_setting('naxa_test.live_pharmacy',true);
  v_rows integer;
  v_denied boolean:=false;
begin
  if v_product is not null and v_product<>'' then
    begin
      perform * from private.marketplace_offre_stock_disponible_guarded(
        v_pharmacy::uuid,v_product::uuid
      );
    exception when insufficient_privilege then
      v_denied:=true;
    end;
    if not v_denied then
      raise exception 'anon a pu appeler directement le helper privé';
    end if;

    select count(*) into v_rows
    from public.marketplace_offre_stock_disponible(v_pharmacy::uuid,v_product::uuid);
    if v_rows<>0 then
      raise exception 'Le wrapper Marketplace a exposé une pharmacie démo/masquée';
    end if;
  end if;

  if v_live_product is not null and v_live_product<>'' then
    select count(*) into v_rows
    from public.marketplace_offre_stock_disponible(v_live_pharmacy::uuid,v_live_product::uuid);
    if v_rows=0 then
      raise exception 'Une fiche pharmacie non validée avec offre publique valide doit rester visible';
    end if;
    if not exists (select 1 from public.produits where id=v_live_product::uuid) then
      raise exception 'La RLS doit autoriser la fiche pharmacie associée à une offre publique';
    end if;
  end if;
end
$anon_test$;
rollback;

select 'Marketplace offer ACL and pharmacy-owned product visibility: PASS' as result;
