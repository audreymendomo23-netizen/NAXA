begin;
do $test$
declare
  v_stocks_read text;
  v_stocks_insert text;
  v_stocks_update text;
  v_stocks_delete text;
  v_lots_read text;
  v_lots_insert text;
  v_lots_update text;
  v_lots_delete text;
  v_costs_read text;
  v_costs_insert text;
  v_costs_update text;
  v_recalls_read text;
  v_treatments_read text;
begin
  select qual into v_stocks_read from pg_policies where schemaname='public' and tablename='stocks' and policyname='stocks_read';
  select with_check into v_stocks_insert from pg_policies where schemaname='public' and tablename='stocks' and policyname='stocks_management_insert';
  select qual||' '||with_check into v_stocks_update from pg_policies where schemaname='public' and tablename='stocks' and policyname='stocks_import_update';
  select coalesce(qual,'')||' '||coalesce(with_check,'') into v_stocks_delete from pg_policies where schemaname='public' and tablename='stocks' and policyname='stocks_management_delete';
  if position('VIEW_STOCK' in coalesce(v_stocks_read,''))=0 or position('can_access_pharmacy' in coalesce(v_stocks_read,''))>0 then
    raise exception 'stocks_read doit imposer VIEW_STOCK, pas le simple scope pharmacie';
  end if;
  if position('VIEW_STOCK' in coalesce(v_stocks_insert,''))=0 or position('IMPORT_STOCK' in coalesce(v_stocks_insert,''))=0 then
    raise exception 'stocks insert doit imposer VIEW_STOCK et IMPORT_STOCK';
  end if;
  if position('VIEW_STOCK' in coalesce(v_stocks_update,''))=0 or position('IMPORT_STOCK' in coalesce(v_stocks_update,''))=0 then
    raise exception 'stocks import update doit imposer VIEW_STOCK et IMPORT_STOCK';
  end if;
  if position('VIEW_STOCK' in coalesce(v_stocks_delete,''))=0 or position('MANAGE_STOCK_ANOMALIES' in coalesce(v_stocks_delete,''))=0 then
    raise exception 'stocks delete doit imposer VIEW_STOCK et MANAGE_STOCK_ANOMALIES';
  end if;

  select qual into v_lots_read from pg_policies where schemaname='public' and tablename='stocks_lots' and policyname='stocks_lots_lecture';
  select with_check into v_lots_insert from pg_policies where schemaname='public' and tablename='stocks_lots' and policyname='stocks_lots_manage_insert';
  select qual||' '||with_check into v_lots_update from pg_policies where schemaname='public' and tablename='stocks_lots' and policyname='stocks_lots_manage_update';
  select qual into v_lots_delete from pg_policies where schemaname='public' and tablename='stocks_lots' and policyname='stocks_lots_manage_delete';
  if position('VIEW_STOCK' in coalesce(v_lots_read,''))=0 or position('MANAGE_LOTS' in coalesce(v_lots_read,''))=0 then
    raise exception 'stocks_lots read doit imposer VIEW_STOCK ou MANAGE_LOTS';
  end if;
  if position('MANAGE_LOTS' in coalesce(v_lots_insert,''))=0 or position('MANAGE_LOTS' in coalesce(v_lots_update,''))=0 or position('MANAGE_LOTS' in coalesce(v_lots_delete,''))=0 then
    raise exception 'stocks_lots insert/update/delete doit imposer MANAGE_LOTS';
  end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename='stocks_lots' and policyname='stocks_lots_equipe' and cmd='ALL') then
    raise exception 'L''ancienne policy ALL des lots ne doit plus autoriser la lecture générique';
  end if;

  select qual into v_costs_read from pg_policies where schemaname='public' and tablename='stocks_couts' and policyname='stocks_couts_lecture';
  select with_check into v_costs_insert from pg_policies where schemaname='public' and tablename='stocks_couts' and policyname='stocks_couts_equipe_maj';
  select qual||' '||with_check into v_costs_update from pg_policies where schemaname='public' and tablename='stocks_couts' and policyname='stocks_couts_equipe_update';
  if position('VIEW_PURCHASE_COST' in coalesce(v_costs_read,''))=0
    or position('EDIT_STOCK_PARAMETERS' in coalesce(v_costs_insert,''))=0
    or position('EDIT_STOCK_PARAMETERS' in coalesce(v_costs_update,''))=0 then
    raise exception 'stocks_couts doit séparer les privilèges lecture et modification';
  end if;

  select qual into v_recalls_read from pg_policies where schemaname='public' and tablename='rappels_lots' and policyname='rappels_lots_read_scope';
  select qual into v_treatments_read from pg_policies where schemaname='public' and tablename='rappels_lots_traitements' and policyname='rappels_lots_traitements_read';
  if position('VIEW_STOCK' in coalesce(v_recalls_read,''))=0 or position('MANAGE_LOTS' in coalesce(v_recalls_read,''))=0
    or position('MANAGE_LOTS' in coalesce(v_treatments_read,''))=0
    or position('VIEW_PURCHASE_COST' in coalesce(v_treatments_read,''))=0 then
    raise exception 'Les lectures de rappels/traitements doivent rester délimitées par les privilèges';
  end if;
end;
$test$;
rollback;
select '275_stock_rls_privilege_alignment PASS' as resultat;
