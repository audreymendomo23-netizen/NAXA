do $$
begin
if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='produits' and column_name='dci') then raise exception 'produits.dci absent'; end if;
if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='produits' and column_name='atc_code') then raise exception 'produits.atc_code absent'; end if;
if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='produits' and column_name='conditionnement') then raise exception 'produits.conditionnement absent'; end if;
if not exists(select 1 from information_schema.tables where table_schema='public' and table_name='produit_equivalences') then raise exception 'produit_equivalences absent'; end if;
end $$;