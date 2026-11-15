-- Contrat SQL : import des assurés, vérification pharmacie, négociation et POS.
do $test$
declare
  v_simulate text;
  v_apply text;
  v_calculate text;
  v_pos text;
  v_link text;
  v_ticket text;
  v_rls boolean;
  v_policy text;
begin
  if to_regclass('public.assurance_imports') is null
     or to_regclass('public.assurance_import_lignes') is null
     or to_regclass('public.assurance_couverture_verifications') is null
     or to_regclass('public.assurance_montant_propositions') is null then
    raise exception 'Tables import, vérification et proposition requises absentes';
  end if;

  select relrowsecurity into v_rls from pg_class
  where oid='public.assurance_imports'::regclass;
  if v_rls is not true then raise exception 'RLS import Assurance absente'; end if;
  select relrowsecurity into v_rls from pg_class
  where oid='public.assurance_import_lignes'::regclass;
  if v_rls is not true then raise exception 'RLS des lignes PII absente'; end if;
  select relrowsecurity into v_rls from pg_class
  where oid='public.assurance_couverture_verifications'::regclass;
  if v_rls is not true then raise exception 'RLS vérification pharmacie absente'; end if;

  if has_table_privilege('authenticated','public.assurance_imports','INSERT')
     or has_table_privilege('authenticated','public.assurance_imports','UPDATE')
     or has_table_privilege('authenticated','public.assurance_import_lignes','INSERT')
     or has_table_privilege('authenticated','public.assurance_import_lignes','UPDATE')
     or has_table_privilege('authenticated','public.assurance_couverture_verifications','INSERT')
     or has_table_privilege('authenticated','public.assurance_couverture_verifications','UPDATE')
     or has_table_privilege('anon','public.assurance_import_lignes','SELECT') then
    raise exception 'Les écritures directes ou la lecture anonyme de données personnelles doivent être interdites';
  end if;

  select qual into v_policy from pg_policies
  where schemaname='public' and tablename='assurance_couverture_verifications'
    and policyname='assurance_couverture_verifications_scope_read' and cmd='SELECT';
  if v_policy is null
     or position('client_id' in v_policy)=0
     or position('can_access_pharmacy' in v_policy)=0 then
    raise exception 'Lecture de vérification limitée au Client propriétaire et à la pharmacie';
  end if;

  if not has_function_privilege('authenticated','public.assurance_import_simuler_mode(uuid,uuid,text,text,text,jsonb,text)','EXECUTE')
     or has_function_privilege('anon','public.assurance_import_simuler_mode(uuid,uuid,text,text,text,jsonb,text)','EXECUTE')
     or has_function_privilege('authenticated','public.assurance_import_simuler(uuid,uuid,text,text,text,jsonb)','EXECUTE')
     or not has_function_privilege('authenticated','public.assurance_import_appliquer(uuid)','EXECUTE')
     or has_function_privilege('anon','public.assurance_import_appliquer(uuid)','EXECUTE') then
    raise exception 'Seule la façade mode complet/delta doit être appelable par authenticated';
  end if;

  v_simulate:=pg_get_functiondef('public.assurance_import_simuler(uuid,uuid,text,text,text,jsonb)'::regprocedure);
  if position('jsonb_array_length(p_lignes)>5000' in v_simulate)=0
     or position('p_sha256' in v_simulate)=0
     or position('correspondance_unique' in v_simulate)=0
     or position('v_match_count>1' in v_simulate)=0
     or position('doublon_fichier' in v_simulate)=0
     or position('case when v_status in (''actif'',''suspendu'',''expire'') then v_status else null end' in v_simulate)=0 then
    raise exception 'Simulation import : validation, dédoublonnage et statut invalide non conforme';
  end if;

  v_apply:=pg_get_functiondef('public.assurance_import_appliquer(uuid)'::regprocedure);
  if position('assurance_couverture_verifications' in v_apply)=0
     or position('mode_import=''complet''' in v_apply)=0
     or position('statut=''remplacee''' in v_apply)=0
     or position('assurance_couverture_verifications' in v_apply)=0
     or position('set actif=' in lower(v_apply))>0 then
    raise exception 'Application import : portée pharmacie, remplacement complet et statut global inchangé requis';
  end if;

  v_calculate:=pg_get_functiondef('public.assurance_calculer_devis(uuid,uuid)'::regprocedure);
  if position('assurance_couverture_verifications' in v_calculate)=0
     or position('where c.id=p_couverture and c.client_id=v_uid' in replace(lower(v_calculate),E'\\n',' '))=0
     or position('v.couverture_id=c.id' in lower(v_calculate))=0
     or position('v2.couverture_id=c.id' in lower(v_calculate))=0
     or position('v.couverture_id=v_c.id' in lower(v_calculate))>0
     or position('v_r.pharmacie_id' in v_calculate)=0
     or position('v.declaration_maj_at=c.declaration_maj_at' in v_calculate)=0
     or position('v.statut=''verifiee''' in v_calculate)=0 then
    raise exception 'Calcul de devis doit exiger la dernière vérification de cette pharmacie et la version de déclaration courante';
  end if;

  v_pos:=pg_get_functiondef('public.vente_reservation_encaisser(uuid,uuid,integer,text,text)'::regprocedure);
  v_link:=pg_get_functiondef('private.assurance_lier_vente_reservation()'::regprocedure);
  if position('v_proposition.montant_assureur_fcfa' in v_pos)=0
     or position('v_proposition.montant_client_fcfa' in v_pos)=0
     or position('proposition de montant attend' in v_pos)=0
     or position('v_proposition.montant_assureur_fcfa' in v_link)=0
     or position('v_proposition.montant_client_fcfa' in v_link)=0
     or position('assurance_couverture_verifications' in v_link)>0 then
    raise exception 'POS/trigger doivent consommer la dernière proposition acceptée et bloquer les propositions en attente';
  end if;

  v_ticket:=pg_get_functiondef('public.get_client_reservation_ticket(uuid)'::regprocedure);
  if position('d.montant_prise_en_charge' in v_ticket)=0
     or position('d.montant_client' in v_ticket)=0
     or position('proposition_acceptee' in v_ticket)=0 then
    raise exception 'Le ticket doit montrer le dernier partage accepté et conserver les montants initiaux';
  end if;
end
$test$;

select 'assurance_import_membership_negotiation_pos_contract PASS' as result;
