-- NAXA ERP-011 — Test structurel F64
select to_regclass('public.rappels_lots') as rappels_lots;
select to_regclass('public.stocks_lots') as stocks_lots;
select exists (
  select 1 from pg_proc
  where pronamespace='public'::regnamespace
    and proname='lot_rappeler'
) as lot_rappeler_exists;
select exists (
  select 1 from pg_proc
  where pronamespace='public'::regnamespace
    and proname='lot_lever_rappel'
) as lot_lever_rappel_exists;
select relrowsecurity
from pg_class
where oid='public.rappels_lots'::regclass;
