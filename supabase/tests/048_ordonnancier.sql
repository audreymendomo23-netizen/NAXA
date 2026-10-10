-- NAXA ERP-007 — Test structurel
do $$
begin
if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='ordonnancier') then raise exception 'ordonnancier absent';end if;
if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='registre_substances_controlees') then raise exception 'registre absent';end if;
if not exists(select 1 from pg_proc where proname='ordonnancier_enregistrer') then raise exception 'RPC absente';end if;
if not exists(select 1 from pg_policies where schemaname='public' and tablename='ordonnancier' and policyname='ordonnancier_staff_read') then raise exception 'RLS ordonnancier absente';end if;
if not exists(select 1 from pg_policies where schemaname='public' and tablename='registre_substances_controlees' and policyname='registre_substances_staff_read') then raise exception 'RLS registre absente';end if;
if has_table_privilege('authenticated','public.ordonnancier','INSERT') then raise exception 'INSERT direct interdit';end if;
if has_table_privilege('authenticated','public.registre_substances_controlees','INSERT') then raise exception 'INSERT registre direct interdit';end if;
end $$;
select '048_ordonnancier PASS' as resultat;
