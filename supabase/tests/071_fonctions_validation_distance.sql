-- NAXA 071 — contrat structurel des fonctions métier et validations à distance.
begin;

do $naxa071$
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
$naxa071$;

select true as naxa_071_fonctions_validation_distance_pass;
rollback;
