-- NAXA ERP-009 — test structurel trésorerie / dépenses
do $$
declare
  v text;
begin
  if to_regclass('public.tresorerie_comptes') is null then raise exception 'ERP-009: tresorerie_comptes absent'; end if;
  if to_regclass('public.categories_depenses') is null then raise exception 'ERP-009: categories_depenses absent'; end if;
  if to_regclass('public.depenses') is null then raise exception 'ERP-009: depenses absent'; end if;
  if to_regclass('public.tresorerie_mouvements') is null then raise exception 'ERP-009: tresorerie_mouvements absent'; end if;
  select relrowsecurity::text into v from pg_class where oid='public.depenses'::regclass;
  if v <> 'true' then raise exception 'ERP-009: RLS depenses absente'; end if;
  if has_table_privilege('authenticated','public.depenses','INSERT') then raise exception 'ERP-009: INSERT direct depenses interdit'; end if;
  if has_table_privilege('authenticated','public.tresorerie_mouvements','INSERT') then raise exception 'ERP-009: INSERT direct mouvements interdit'; end if;
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='depense_creer') then raise exception 'ERP-009: RPC depense_creer absente'; end if;
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='depense_valider') then raise exception 'ERP-009: RPC depense_valider absente'; end if;
end $$;
