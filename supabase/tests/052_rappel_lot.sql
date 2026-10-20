-- NAXA ERP-011 / F64 — structure, privilèges et dépendance POS.
begin;
do $structure$
declare v_recall text; v_lift text; v_sale text; v_lot_create text;
begin
 if to_regclass('public.rappels_lots') is null or to_regclass('public.stocks_lots') is null then
  raise exception 'Tables canonique de lots/rappels absentes';
 end if;
 if not (select relrowsecurity from pg_class where oid='public.rappels_lots'::regclass) then
  raise exception 'RLS absent sur rappels_lots';
 end if;
 if has_table_privilege('authenticated','public.rappels_lots','INSERT')
    or has_table_privilege('authenticated','public.rappels_lots','UPDATE')
    or has_table_privilege('authenticated','public.rappels_lots','DELETE') then
  raise exception 'Écriture directe sur les événements de rappel encore autorisée';
 end if;
 if has_table_privilege('authenticated','public.stocks_lots','INSERT')
    or has_table_privilege('authenticated','public.stocks_lots','UPDATE')
    or has_table_privilege('authenticated','public.stocks_lots','DELETE') then
  raise exception 'Écriture directe sur stocks_lots encore autorisée';
 end if;
 if not exists(select 1 from pg_indexes where schemaname='public' and indexname='rappels_lots_un_actif_par_lot_uidx' and indexdef ilike '%where (statut = ''actif''%') then
  raise exception 'Unicité des seuls rappels actifs absente';
 end if;
 select pg_get_functiondef('public.lot_rappeler(uuid,text,text)'::regprocedure) into v_recall;
 select pg_get_functiondef('public.lot_lever_rappel(uuid)'::regprocedure) into v_lift;
 select pg_get_functiondef('public.vente_ajouter_produit(uuid,uuid,integer)'::regprocedure) into v_sale;
 select pg_get_functiondef('public.stock_lot_enregistrer(uuid,uuid,text,date,integer,uuid)'::regprocedure) into v_lot_create;
 if position('search_path=""' in replace(coalesce((select array_to_string(proconfig,',') from pg_proc where oid='public.lot_rappeler(uuid,text,text)'::regprocedure),''),' ',''))=0
    or position('naxa_has_privilege' in lower(v_recall))=0 then
  raise exception 'Garde de portée ou search_path de lot_rappeler incomplet';
 end if;
 if position('promoteur' in lower(v_lift))=0 or position('v_profile' in lower(v_lift))=0 then
  raise exception 'Clôture du rappel non réservée au Promoteur actif';
 end if;
 if position('bloque=false' in lower(v_sale))=0 or position('date_peremption >= current_date' in lower(v_sale))=0 then
  raise exception 'Le POS ne filtre pas les lots bloqués/expirés';
 end if;
 if v_lot_create is null or position('v_stock.quantite' in lower(v_lot_create))=0 or position('v_source.quantite' in lower(v_lot_create))=0 then
  raise exception 'Enregistrement lot ne protège pas les quantités agrégées';
 end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.stocks'::regclass and tgname='trg_stocks_guard_lot_quantity_consistency' and not tgisinternal) then
  raise exception 'Garde anti-désynchronisation stock/lots absente';
 end if;
 if not exists(select 1 from pg_trigger where tgrelid='public.stocks_lots'::regclass and tgname='trg_stocks_lots_sync_compat' and not tgisinternal) then
  raise exception 'Synchronisation des colonnes historiques/canoniques absente';
 end if;
 if has_function_privilege('anon','public.lot_rappeler(uuid,text,text)','EXECUTE')
    or has_function_privilege('anon','public.lot_lever_rappel(uuid)','EXECUTE')
    or has_function_privilege('anon','public.stock_lot_enregistrer(uuid,uuid,text,date,integer,uuid)','EXECUTE') then
  raise exception 'RPC lot/rappel accessible à anon';
 end if;
end
$structure$;
select '052_rappel_lot STRUCTURE PASS' as resultat;
rollback;
