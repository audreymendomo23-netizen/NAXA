-- Regression for the private marketplace stock offer implementation.
-- The public endpoint remains callable but never reveals an unvalidated record.

do $test$
declare
  v_public record;
  v_private record;
  v_product uuid;
  v_pharmacy uuid;
begin
  select p.prosecdef,p.proconfig,p.proacl
    into v_public
  from pg_proc p
  where p.oid='public.marketplace_offre_stock_disponible(uuid,uuid)'::regprocedure;
  if not found or v_public.prosecdef is not true
     or not (v_public.proconfig::text like '%search_path=%') then
    raise exception 'Le wrapper public doit être SECURITY DEFINER avec search_path explicite';
  end if;

  select p.proacl into v_private
  from pg_proc p
  where p.oid='private.marketplace_offre_stock_disponible_guarded(uuid,uuid)'::regprocedure;
  if has_function_privilege('anon','private.marketplace_offre_stock_disponible_guarded(uuid,uuid)','EXECUTE')
     or has_function_privilege('authenticated','private.marketplace_offre_stock_disponible_guarded(uuid,uuid)','EXECUTE') then
    raise exception 'Le helper privé ne doit plus être directement exécutable par anon/authenticated';
  end if;

  if not has_function_privilege('anon','public.marketplace_offre_stock_disponible(uuid,uuid)','EXECUTE')
     or not has_function_privilege('authenticated','public.marketplace_offre_stock_disponible(uuid,uuid)','EXECUTE') then
    raise exception 'Le point d''entrée public filtré doit rester exécutable';
  end if;

  select p.id,s.pharmacie_id into v_product,v_pharmacy
  from public.produits p
  join public.stocks s on s.produit_id=p.id
  where p.fiche_validee is not true
  limit 1;
  if v_product is null or v_pharmacy is null then
    raise exception 'Fixture non validée avec stock attendue pour le test de non-publication';
  end if;

  perform set_config('naxa_test.unvalidated_product',v_product::text,true);
  perform set_config('naxa_test.stock_pharmacy',v_pharmacy::text,true);
end
$test$;

begin;
set local role anon;
do $anon_test$
declare
  v_product uuid := current_setting('naxa_test.unvalidated_product')::uuid;
  v_pharmacy uuid := current_setting('naxa_test.stock_pharmacy')::uuid;
  v_rows integer;
  v_denied boolean := false;
begin
  begin
    perform * from private.marketplace_offre_stock_disponible_guarded(v_pharmacy,v_product);
  exception when insufficient_privilege then
    v_denied := true;
  end;
  if not v_denied then
    raise exception 'anon a pu appeler directement le helper privé';
  end if;

  select count(*) into v_rows
  from public.marketplace_offre_stock_disponible(v_pharmacy,v_product);
  if v_rows <> 0 then
    raise exception 'Le wrapper public a exposé une offre pour un produit non validé';
  end if;
end
$anon_test$;
rollback;

select 'Marketplace RPC: helper private denied to anon; public wrapper remains callable and suppresses unvalidated products: PASS' as result;
