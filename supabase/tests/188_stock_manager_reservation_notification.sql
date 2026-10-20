-- NAXA 188 — test structurel de la notification groupée des réservations stock.
begin;

do $test$
declare
  v_fn text;
  v_trigger text;
begin
  if to_regclass('public.reservations') is null
     or to_regclass('public.reservation_items') is null
     or to_regclass('public.stocks') is null
     or to_regclass('public.stocks_lots') is null
     or to_regclass('public.notifications') is null then
    raise exception 'Une table requise pour la réservation/stock/notification est absente';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='stocks' and column_name='emplacement'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='stocks_lots' and column_name='emplacement'
  ) then
    raise exception 'Les colonnes de localisation stock/lot sont absentes';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='notifications' and column_name='reservation_id'
  ) then
    raise exception 'Le lien notification -> réservation est absent';
  end if;

  select pg_get_functiondef(p.oid) into v_fn
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='actualiser_notification_reservation_gestion_stock'
    and p.pronargs=0;

  if v_fn is null
     or position('reservation_items' in lower(v_fn))=0
     or position('stocks_lots' in lower(v_fn))=0
     or position('date_peremption' in lower(v_fn))=0
     or position('emplacement' in lower(v_fn))=0
     or position('notifications' in lower(v_fn))=0
     or position('on conflict' in lower(v_fn))=0 then
    raise exception 'La notification ne regroupe pas les lignes et les informations de stock/lot ou ne protège pas les doublons';
  end if;

  select pg_get_triggerdef(t.oid) into v_trigger
  from pg_trigger t
  where t.tgrelid='public.reservation_items'::regclass
    and t.tgname='trg_actualiser_notification_reservation_gestion_stock'
    and not t.tgisinternal;

  if v_trigger is null
     or (position('AFTER' in upper(v_trigger))=0 or position('INSERT' in upper(v_trigger))=0 or position('UPDATE' in upper(v_trigger))=0 or position('DELETE' in upper(v_trigger))=0) then
    raise exception 'Le déclencheur doit actualiser le dossier lors des mutations de ses lignes produits';
  end if;

  if has_function_privilege('authenticated','private.notifier_reservation_gestion_stock()','EXECUTE')
     or has_function_privilege('anon','private.notifier_reservation_gestion_stock()','EXECUTE') then
    raise exception 'La fonction interne du déclencheur ne doit pas être appelable par les rôles applicatifs';
  end if;
end
$test$;

select '188_stock_manager_reservation_notification PASS' as resultat;
rollback;
