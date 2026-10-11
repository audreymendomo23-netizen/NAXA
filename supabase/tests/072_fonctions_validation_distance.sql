-- NAXA 072 — contrat structurel des fonctions métier et validations à distance.
begin;

do $naxa072$
declare
  v_count integer;
  v_def text;
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.profiles'::regclass
      and conname='profiles_fonction_interne_check'
      and pg_get_constraintdef(oid) like '%pharmacien%'
      and pg_get_constraintdef(oid) like '%comptable%'
      and pg_get_constraintdef(oid) like '%magasinier%'
  ) then
    raise exception 'Catalogue fonction_interne incomplet';
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid='public.profiles'::regclass
      and conname='profiles_fonction_interne_ck'
  ) then
    raise exception 'Contrainte historique contradictoire encore présente';
  end if;

  -- Contrat de compatibilité : les colonnes historiques et canoniques sont toutes remplies.
  select count(*) into v_count
  from public.naxa_privileges
  where code in (
    'SUBMIT_PHARMACEUTICAL_VALIDATION','VIEW_PHARMACEUTICAL_VALIDATIONS',
    'VALIDATE_PHARMACEUTICAL_DOCUMENT','REQUEST_PHARMACEUTICAL_INFO',
    'VIEW_PHARMACEUTICAL_AUDIT','MANAGE_ACCOUNTING',
    'MANAGE_STOCK_OPERATIONS','RECEIVE_STOCK'
  );
  if v_count <> 8 then
    raise exception 'Catalogue 072 incomplet : % privilèges sur 8',v_count;
  end if;

  -- Schéma Production et schéma de test peuvent différer. Contrôler les colonnes
  -- garanties et les alias optionnels via JSON afin de ne pas référencer une colonne absente.
  select count(*) into v_count
  from public.naxa_privileges p
  where p.code in (
    'SUBMIT_PHARMACEUTICAL_VALIDATION','VIEW_PHARMACEUTICAL_VALIDATIONS',
    'VALIDATE_PHARMACEUTICAL_DOCUMENT','REQUEST_PHARMACEUTICAL_INFO',
    'VIEW_PHARMACEUTICAL_AUDIT','MANAGE_ACCOUNTING',
    'MANAGE_STOCK_OPERATIONS','RECEIVE_STOCK'
  )
  and (
    p.family is null or p.description is null or p.delegable is null
    or p.governance is null or p.niveau_min is null or p.niveau_max is null or p.active is null
    or (to_jsonb(p) ? 'famille' and (to_jsonb(p)->>'famille') is distinct from p.family)
    or (to_jsonb(p) ? 'libelle' and (to_jsonb(p)->>'libelle') is distinct from p.description)
    or (to_jsonb(p) ? 'governance_only' and (to_jsonb(p)->>'governance_only') is null)
  );
  if v_count <> 0 then
    raise exception 'Colonnes de privilèges 072 NULL ou alias désynchronisés : % lignes',v_count;
  end if;

  if not (select relrowsecurity from pg_class where oid='public.naxa_validations_pharmaceutiques'::regclass) then
    raise exception 'RLS absente sur les validations pharmaceutiques';
  end if;

  select count(*) into v_count
  from public.naxa_role_privileges
  where (role_key='pharmacien' and privilege_code in ('VIEW_PHARMACEUTICAL_VALIDATIONS','VALIDATE_PHARMACEUTICAL_DOCUMENT','REQUEST_PHARMACEUTICAL_INFO'))
     or (role_key in ('preparateur','agent_accueil') and privilege_code='SUBMIT_PHARMACEUTICAL_VALIDATION');
  if v_count <> 5 then
    raise exception 'Matrice de privilèges pharmaceutiques incomplète : % lignes',v_count;
  end if;

  select count(*) into v_count
  from public.naxa_architecture_privileges
  where architecture_code in ('ORPHELIN','PARENTS_ENFANTS','PARENTS_AINES_CADETS','HYBRIDE')
    and role_key='pharmacien'
    and privilege_code='VALIDATE_PHARMACEUTICAL_DOCUMENT';
  if v_count <> 4 then
    raise exception 'La validation pharmaceutique ne couvre pas les quatre architectures : %',v_count;
  end if;

  if coalesce((select public from storage.buckets where id='naxa-validations-pharmaceutiques'),true) then
    raise exception 'Le bucket des documents pharmaceutiques doit rester privé';
  end if;
  if not (select relrowsecurity from pg_class where oid='public.naxa_validations_pharmaceutiques_audit'::regclass) then
    raise exception 'RLS absente sur la piste d''audit pharmaceutique';
  end if;

  if not (select relrowsecurity from pg_class where oid='public.naxa_validations_pharmaceutiques_notifications'::regclass) then
    raise exception 'RLS absente sur les notifications pharmaceutiques';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.naxa_validations_pharmaceutiques'::regclass
      and tgname='trg_naxa_auditer_validation_pharmaceutique'
      and not tgisinternal
  ) then
    raise exception 'Trigger de journalisation pharmaceutique absent';
  end if;


  v_def := pg_get_functiondef('public.naxa_decider_validation_pharmaceutique(uuid,text,text)'::regprocedure);
  if position('Auto-validation interdite' in v_def)=0
     or position('v_fn <> ''pharmacien''' in v_def)=0
     or position('VALIDATE_PHARMACEUTICAL_DOCUMENT' in v_def)=0 then
    raise exception 'Garde-fous de décision pharmaceutique incomplets';
  end if;

  v_def := pg_get_functiondef('public.naxa_soumettre_dossier_validation_pharmaceutique(uuid)'::regprocedure);
  if position('Document privé manquant' in v_def)=0
     or position('storage.objects' in v_def)=0 then
    raise exception 'La soumission ne vérifie pas la présence du document privé';
  end if;

  if has_table_privilege('authenticated','public.naxa_validations_pharmaceutiques','INSERT')
     or has_table_privilege('authenticated','public.naxa_validations_pharmaceutiques','UPDATE')
     or has_table_privilege('authenticated','public.naxa_validations_pharmaceutiques','DELETE') then
    raise exception 'Les utilisateurs authentifiés ne doivent pas modifier directement les validations';
  end if;
end;
$naxa072$;


  -- Régression du moteur : les fonctions internes doivent être résolues sans
  -- les convertir en role_type ni leur donner les droits d'un Promoteur.
  v_def := pg_get_functiondef('private.naxa_business_function(uuid)'::regprocedure);
  if position('pharmacien' in v_def)=0
     or position('preparateur' in v_def)=0
     or position('agent_accueil' in v_def)=0
     or position('comptable' in v_def)=0
     or position('gestionnaire_stock' in v_def)=0
     or position('magasinier' in v_def)=0 then
    raise exception 'Le moteur ne résout pas toutes les fonctions internes';
  end if;

  v_def := pg_get_functiondef('private.naxa_has_privilege(text,uuid,text)'::regprocedure);
  if position('pharmacien' in v_def)=0
     or position('preparateur' in v_def)=0
     or position('agent_accueil' in v_def)=0
     or position('comptable' in v_def)=0
     or position('gestionnaire_stock' in v_def)=0
     or position('magasinier' in v_def)=0
     or position('naxa_profile_privileges' in v_def)=0
     or position('naxa_architecture_privileges' in v_def)=0 then
    raise exception 'Le moteur ne borne pas les nouvelles fonctions par architecture et délégation';
  end if;

  if position('naxa_scope_allows' in v_def)=0
     or position('scope_type' in v_def)=0
     or position('RESEAU' in v_def)=0 then
    raise exception 'Le contrôle du périmètre pharmacie/réseau est incomplet';
  end if;

select true as naxa_072_fonctions_validation_distance_pass;
rollback;
