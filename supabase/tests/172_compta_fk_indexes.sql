-- NAXA Comptable — vérifie les index couvrants ajoutés pour les FK.
-- Test structurel en lecture seule, sans fixture métier.
begin;

do $test$
declare
  v_missing text;
begin
  with attendu(table_name, index_name, columns_sql) as (
    values
      ('compta_audit','compta_audit_acteur_idx','(acteur_id)'),
      ('compta_controles_cloture','compta_controles_cloture_controle_par_idx','(controle_par)'),
      ('compta_controles_cloture','compta_controles_cloture_periode_pharmacie_fk_idx','(periode_id, pharmacie_id)'),
      ('compta_ecriture','compta_ecriture_contrepassation_pharmacie_fk_idx','(contrepassation_de, pharmacie_id)'),
      ('compta_ecriture','compta_ecriture_cree_par_idx','(cree_par)'),
      ('compta_ecriture','compta_ecriture_periode_pharmacie_fk_idx','(periode_id, pharmacie_id)'),
      ('compta_ligne','compta_ligne_compte_pharmacie_fk_idx','(compte_id, pharmacie_id)'),
      ('compta_ligne','compta_ligne_ecriture_pharmacie_fk_idx','(ecriture_id, pharmacie_id)'),
      ('compta_mapping_compte','compta_mapping_compte_compte_pharmacie_fk_idx','(compte_id, pharmacie_id)'),
      ('compta_mapping_compte','compta_mapping_compte_valide_par_idx','(valide_par)'),
      ('compta_parametre','compta_parametre_valide_par_idx','(valide_par)'),
      ('compta_periodes','compta_periodes_cloturee_par_idx','(cloturee_par)'),
      ('compta_plan_comptable','compta_plan_comptable_valide_par_idx','(valide_par)')
  )
  select string_agg(a.index_name, ', ' order by a.index_name)
  into v_missing
  from attendu a
  where not exists (
    select 1
    from pg_class idx
    join pg_namespace ns on ns.oid=idx.relnamespace
    join pg_index pi on pi.indexrelid=idx.oid
    join pg_class tbl on tbl.oid=pi.indrelid
    join pg_namespace tns on tns.oid=tbl.relnamespace
    where ns.nspname='public'
      and tns.nspname='public'
      and tbl.relname=a.table_name
      and idx.relname=a.index_name
      and pg_get_indexdef(idx.oid) like '%' || a.columns_sql || '%'
      and pi.indisvalid
  );

  if v_missing is not null then
    raise exception 'Index FK comptables absent ou invalide : %', v_missing;
  end if;
end;
$test$;

rollback;
select '172_compta_fk_indexes PASS' as resultat;
