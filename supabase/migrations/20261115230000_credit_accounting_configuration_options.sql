-- NAXA — Autoriser la configuration comptable des événements de crédit.
-- La configuration reste soumise au contrôle Comptable/Promoteur existant.
-- Aucun compte, mapping, journal ou période commercial n'est créé ici.
begin;

do $migration$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.compta_config_enregistrer_journal(uuid,uuid,text,text,date,date)'::regprocedure
  ) into v_definition;

  v_old := E'''vente_encaissee'',''depense_validee'',''vente_annulee'',\n    ''assurance_prise_en_charge'',''assurance_remboursement_recu''';
  v_new := v_old || E',\n    ''credit_octroi'',''credit_remboursement''';

  if position(v_old in v_definition)=0 then
    raise exception 'Whitelist du journal comptable inattendue ; migration interrompue';
  end if;
  if position('credit_octroi' in v_definition)>0
     or position('credit_remboursement' in v_definition)>0 then
    raise exception 'La configuration journal du crédit est déjà modifiée ; migration interrompue';
  end if;

  v_definition:=replace(v_definition,v_old,v_new);
  execute v_definition;
end
$migration$;

do $migration$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(
    'public.compta_plan_enregistrer_mapping(uuid,uuid,text,text,uuid,date,date)'::regprocedure
  ) into v_definition;

  v_old := E'''vente_encaissee'',''depense_validee'',\n      ''assurance_prise_en_charge'',''assurance_remboursement_recu''';
  v_new := v_old || E',\n      ''credit_octroi'',''credit_remboursement''';

  if position(v_old in v_definition)=0 then
    raise exception 'Whitelist des mappings comptables inattendue ; migration interrompue';
  end if;
  if position('credit_octroi' in v_definition)>0
     or position('credit_remboursement' in v_definition)>0 then
    raise exception 'La configuration mapping du crédit est déjà modifiée ; migration interrompue';
  end if;

  v_definition:=replace(v_definition,v_old,v_new);
  execute v_definition;
end
$migration$;

commit;
