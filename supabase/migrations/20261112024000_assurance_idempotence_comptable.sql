-- Aligner l'idempotence des événements Assurance sur la clé composite comptable existante.
do $$
declare v_def text; v_old text:='on conflict (cle_idempotence) do nothing';
        v_new text:='on conflict (pharmacie_id,cle_idempotence) do nothing';
begin
  v_def:=pg_get_functiondef('public.assurance_confirmer_prise_en_charge(uuid,text)'::regprocedure);
  if position(v_old in v_def)>0 then
    v_def:=replace(v_def,v_old,v_new);
    execute v_def;
  elsif position(v_new in v_def)=0 then
    raise exception 'Contrat idempotence confirmation assurance inattendu';
  end if;
  v_def:=pg_get_functiondef('public.assurance_enregistrer_remboursement(uuid,bigint,date,text,text)'::regprocedure);
  if position(v_old in v_def)>0 then
    v_def:=replace(v_def,v_old,v_new);
    execute v_def;
  elsif position(v_new in v_def)=0 then
    raise exception 'Contrat idempotence remboursement assurance inattendu';
  end if;
end
$$;
