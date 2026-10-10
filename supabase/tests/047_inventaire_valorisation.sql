do $$ begin
if to_regclass('public.inventaires') is null then raise exception 'ERP-006: inventaires absent'; end if;
if to_regclass('public.inventaire_lignes') is null then raise exception 'ERP-006: inventaire_lignes absent'; end if;
if not exists(select 1 from pg_attribute where attrelid='public.inventaire_lignes'::regclass and attname='quantite_comptee') then raise exception 'ERP-006: comptage absent'; end if;
if not exists(select 1 from pg_attribute where attrelid='public.inventaire_lignes'::regclass and attname='cout_unitaire') then raise exception 'ERP-006: coût absent'; end if;
if not exists(select 1 from pg_attribute where attrelid='public.vente_lignes'::regclass and attname='cout_unitaire_fige') then raise exception 'ERP-006: gel coût vente absent'; end if;
if not exists(select 1 from pg_trigger where tgname='trg_vente_ligne_figer_cout') then raise exception 'ERP-006: trigger gel coût absent'; end if;
end $$;
select '047_inventaire_valorisation PASS' as resultat;
