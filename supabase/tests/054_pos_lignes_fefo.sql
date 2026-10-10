-- NAXA ERP-003 — Test structurel POS étape 1
do $$
begin
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='vente_lignes' and column_name='lot_id') then raise exception 'vente_lignes.lot_id absent'; end if;
 if not exists(select 1 from pg_proc where proname='vente_ajouter_produit') then raise exception 'vente_ajouter_produit absent'; end if;
 if not exists(select 1 from pg_proc where proname='vente_recalculer_totaux') then raise exception 'vente_recalculer_totaux absent'; end if;
end $$;
select '054_pos_lignes_fefo PASS' as resultat;
