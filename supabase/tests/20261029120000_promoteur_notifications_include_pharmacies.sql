-- NAXA — contrat des notifications de validité et de règlement avec les pharmacies rattachées.
-- À exécuter sur une base de test après 20261029120000.
begin;
do $test$
declare
  v_submit text;
  v_reminder text;
  v_submit_secdef boolean;
  v_reminder_secdef boolean;
begin
  select pg_get_functiondef(p.oid), p.prosecdef
    into v_submit, v_submit_secdef
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='promoteur_soumettre_reglement'
    and pg_get_function_identity_arguments(p.oid)='p_promoteur uuid, p_montant integer, p_canal text, p_canal_autre text, p_compte_payeur text, p_reference text, p_paye_le timestamp with time zone, p_preuve_path text';

  select pg_get_functiondef(p.oid), p.prosecdef
    into v_reminder, v_reminder_secdef
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='generer_rappels_echeance_promoteurs'
    and pg_get_function_identity_arguments(p.oid)='';

  if v_submit is null or v_reminder is null then
    raise exception 'RPC de déclaration ou de rappel absente';
  end if;
  if v_submit_secdef is distinct from true or v_reminder_secdef is distinct from true then
    raise exception 'Les fonctions de notification doivent conserver SECURITY DEFINER';
  end if;
  if position('v_pharmacies_label' in lower(v_submit))=0
     or position('pharmacie(s)' in lower(v_submit))=0
     or position('string_agg(ph.nom' in lower(v_submit))=0 then
    raise exception 'La notification de déclaration de paiement ne nomme pas les pharmacies';
  end if;
  if position('r.pharmacies_noms' in lower(v_reminder))=0
     or position('string_agg(ph.nom' in lower(v_reminder))=0
     or position('rappel_5j_en_cours_at is null' in lower(v_reminder))=0 then
    raise exception 'Le rappel J-5 doit inclure le réseau pharmacie et respecter le verrou de rappel';
  end if;
  if has_function_privilege('anon','public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text)','EXECUTE')
     or has_function_privilege('authenticated','public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text)','EXECUTE')
     or not has_function_privilege('service_role','public.promoteur_soumettre_reglement(uuid,integer,text,text,text,text,timestamptz,text)','EXECUTE') then
    raise exception 'Les droits de la RPC de déclaration ont changé';
  end if;
  if has_function_privilege('anon','public.generer_rappels_echeance_promoteurs()','EXECUTE')
     or has_function_privilege('authenticated','public.generer_rappels_echeance_promoteurs()','EXECUTE')
     or not has_function_privilege('service_role','public.generer_rappels_echeance_promoteurs()','EXECUTE') then
    raise exception 'Les droits du job de rappel ont changé';
  end if;
end
$test$;
rollback;
select 'promoteur_notifications_include_pharmacies PASS (structurel)' as resultat;
