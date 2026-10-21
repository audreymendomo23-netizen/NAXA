-- Vérifications structurelles de la disponibilité vendable Marketplace.
-- À exécuter après migration_210_marketplace_sellable_stock.sql.
begin;

do $test$
declare
  v_definition text;
begin
  if to_regprocedure('public.marketplace_offre_stock_disponible(uuid,uuid)') is null then
    raise exception 'RPC marketplace_offre_stock_disponible absente';
  end if;

  select pg_get_functiondef('public.marketplace_offre_stock_disponible(uuid,uuid)'::regprocedure)
    into v_definition;

  if position('stocks_lots' in v_definition) = 0
     or position('bloque' in v_definition) = 0
     or position('date_peremption' in v_definition) = 0 then
    raise exception 'La disponibilité Marketplace ne filtre pas les lots bloqués/périmés';
  end if;

  if not has_function_privilege('anon', 'public.marketplace_offre_stock_disponible(uuid,uuid)', 'EXECUTE') then
    raise exception 'Le rôle anon ne peut pas lire la disponibilité publique';
  end if;

  if not has_function_privilege('authenticated', 'public.marketplace_offre_stock_disponible(uuid,uuid)', 'EXECUTE') then
    raise exception 'Le rôle authenticated ne peut pas lire la disponibilité';
  end if;

  if exists (
    select 1
    from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where p.oid = 'public.marketplace_offre_stock_disponible(uuid,uuid)'::regprocedure
      and a.grantee = 0
      and a.privilege_type = 'EXECUTE'
  ) then
    raise exception 'La fonction ne doit pas être exécutable par PUBLIC';
  end if;
end;
$test$;

rollback;
