-- NAXA 297 — sécuriser les RPC Pharmacien par le poste et la pharmacie actifs.
begin;

do $patch$
declare
  v_sql text;
  v_old text;
  v_new text;
begin
  -- Consultations et prescriptions rédigées dans la pharmacie active.
  v_sql:=pg_get_functiondef('public.pharmacien_creer_consultation(uuid,text,text,uuid,text,text,text)'::regprocedure);
  v_old:=$old$not exists(select 1 from public.profiles p where p.id=u and p.actif and p.pharmacie_id=p_pharmacie and p.fonction_interne='pharmacien')$old$;
  v_new:=$new$public.naxa_business_function(u)<>'pharmacien'
    or public.naxa_active_role_pharmacy(u) is distinct from p_pharmacie$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde consultation Pharmacien introuvable'; end if;
  execute replace(v_sql,'if '||v_old||'
    then raise exception ''Création de consultation non autorisée''; end if;','if '||v_new||'
    then raise exception ''Création de consultation non autorisée''; end if;');

  v_sql:=pg_get_functiondef('public.pharmacien_creer_prescription(uuid,text,uuid,uuid,text,text,integer,text,text,text,text)'::regprocedure);
  v_old:=$old$not exists(select 1 from public.profiles p where p.id=u and p.actif and p.pharmacie_id=p_pharmacie and p.fonction_interne='pharmacien')$old$;
  if position(v_old in v_sql)=0 then raise exception 'Garde prescription Pharmacien introuvable'; end if;
  v_sql:=replace(v_sql,v_old,$new$public.naxa_business_function(u)<>'pharmacien'
    or public.naxa_active_role_pharmacy(u) is distinct from p_pharmacie$new$);
  v_sql:=replace(v_sql,
    $old$if public.naxa_business_function(u)<>'pharmacien'
    or public.naxa_active_role_pharmacy(u) is distinct from p_pharmacie
    then raise exception 'Émission de prescription non autorisée'; end if;$old$,
    $new$if public.naxa_business_function(u)<>'pharmacien'
    or public.naxa_active_role_pharmacy(u) is distinct from p_pharmacie
    then raise exception 'Émission de prescription non autorisée'; end if;$new$);
  execute v_sql;

  -- La prescription à compléter doit appartenir au scope Pharmacien actif.
  v_sql:=pg_get_functiondef('public.pharmacien_demander_complement(uuid,text)'::regprocedure);
  v_old:=$old$select 1 from public.profiles p where p.id=u and p.actif
      and p.pharmacie_id=v.pharmacie_id and p.fonction_interne='pharmacien'$old$;
  v_new:=$new$select 1 from public.profiles p where p.id=u and p.actif
      and public.naxa_business_function(u)='pharmacien'
      and public.naxa_active_role_pharmacy(u)=v.pharmacie_id$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde complément Pharmacien introuvable'; end if;
  execute replace(v_sql,v_old,v_new);

  -- Lecture des prescriptions du seul scope actif.
  v_sql:=pg_get_functiondef('public.pharmacien_prescriptions_recentes(uuid,integer)'::regprocedure);
  v_old:=$old$p.id=(select auth.uid()) and p.actif and p.pharmacie_id=p_pharmacie and p.fonction_interne='pharmacien'$old$;
  v_new:=$new$p.id=(select auth.uid()) and p.actif
    and public.naxa_business_function(p.id)='pharmacien'
    and public.naxa_active_role_pharmacy(p.id)=p_pharmacie$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde lecture prescriptions Pharmacien introuvable'; end if;
  execute replace(v_sql,v_old,v_new);

  -- Validation Pharmacien : l'identité de base n'accorde plus ce poste.
  v_sql:=pg_get_functiondef('public.prescription_valider(uuid,boolean,text)'::regprocedure);
  v_old:=$old$  select p.role::text,p.fonction_interne into v_role,v_fn
  from public.profiles p
  where p.id=u and p.actif and p.pharmacie_id=v.pharmacie_id;

  if v_role is null or v_fn <> 'pharmacien' then
    raise exception 'Validation ordonnance non autorisée : poste Pharmacien requis';
  end if;$old$;
  v_new:=$new$  v_role:=public.naxa_business_function(u);
  v_fn:=v_role;
  if v_role is distinct from 'pharmacien'
     or public.naxa_active_role_pharmacy(u) is distinct from v.pharmacie_id then
    raise exception 'Validation ordonnance non autorisée : poste Pharmacien requis';
  end if;$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde validation ordonnance Pharmacien introuvable'; end if;
  execute replace(v_sql,v_old,v_new);

  -- Préparation d'ordonnance côté pharmacie.
  v_sql:=pg_get_functiondef('public.pharmacien_soumettre_preparation(uuid,text)'::regprocedure);
  v_old:=$old$  select pharmacie_id into p from public.profiles
   where id=u and actif and fonction_interne='pharmacien';$old$;
  v_new:=$new$  p:=public.naxa_active_role_pharmacy(u);
  if public.naxa_business_function(u)<>'pharmacien' then p:=null; end if;$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde soumission préparation Pharmacien introuvable'; end if;
  execute replace(v_sql,v_old,v_new);

  -- Exports audités dans la pharmacie du poste actif.
  v_sql:=pg_get_functiondef('public.pharmacien_journaliser_export(text,integer)'::regprocedure);
  v_old:=$old$  select pr.pharmacie_id into p
  from public.profiles pr
  join public.pharmacies f on f.id=pr.pharmacie_id and f.actif=true
  where pr.id=u and pr.actif=true and pr.fonction_interne='pharmacien';$old$;
  v_new:=$new$  p:=public.naxa_active_role_pharmacy(u);
  if public.naxa_business_function(u)<>'pharmacien'
     or not exists(select 1 from public.pharmacies f where f.id=p and f.actif=true) then
    p:=null;
  end if;$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde export Pharmacien introuvable'; end if;
  execute replace(v_sql,v_old,v_new);

  -- Ouverture du service Pharmacien dans la seule pharmacie sélectionnée.
  v_sql:=pg_get_functiondef('public.pharmacien_service_demarrer(text)'::regprocedure);
  v_old:=$old$  select pharmacie_id into p
  from public.profiles
  where id = u and actif = true and fonction_interne = 'pharmacien';$old$;
  v_new:=$new$  p:=public.naxa_active_role_pharmacy(u);
  if public.naxa_business_function(u)<>'pharmacien' then p:=null; end if;$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde ouverture service Pharmacien introuvable'; end if;
  execute replace(v_sql,v_old,v_new);

  -- Clôture d'un service seulement si son scope correspond encore au poste actif.
  v_sql:=pg_get_functiondef('public.pharmacien_service_terminer(uuid,text)'::regprocedure);
  v_old:=$old$  if not exists (
    select 1 from public.profiles p
    where p.id = u and p.actif = true and p.fonction_interne = 'pharmacien'
  ) then raise exception 'Accès réservé à un compte Pharmacien actif'; end if;$old$;
  v_new:=$new$  if public.naxa_business_function(u)<>'pharmacien'
     or not exists(select 1 from public.pharmacien_service_sessions s
       where s.id=p_session and s.pharmacien_id=u
         and s.pharmacie_id=public.naxa_active_role_pharmacy(u)
         and s.ended_at is null) then
    raise exception 'Accès réservé au titulaire actif du service Pharmacien';
  end if;$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde clôture service Pharmacien introuvable'; end if;
  execute replace(v_sql,v_old,v_new);

  -- L'ordonnancier reste accessible au Promoteur dans son réseau, ou au poste
  -- Pharmacien / Assistant explicitement actif pour la pharmacie de la vente.
  v_sql:=pg_get_functiondef('public.ordonnancier_enregistrer(uuid,uuid,uuid,text,integer,text,text,boolean,text,text)'::regprocedure);
  v_old:=$old$if not exists(select 1 from public.profiles p where p.id=v_user and p.actif and p.pharmacie_id=v_prescription.pharmacie_id and (p.role='promoteur' or p.fonction_interne='pharmacien_assistant')) then raise exception 'Inscription ordonnancier non autorisée';end if;$old$;
  v_new:=$new$if not (
  (public.naxa_business_function(v_user)='promoteur'
    and private.naxa_promoteur_valide(v_user)
    and private.naxa_scope_allows(v_user,v_prescription.pharmacie_id,'PHARMACIE'))
  or
  (public.naxa_business_function(v_user) in ('pharmacien','pharmacien_assistant')
    and public.naxa_active_role_pharmacy(v_user)=v_prescription.pharmacie_id)
) then raise exception 'Inscription ordonnancier non autorisée';end if;$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde ordonnancier introuvable'; end if;
  execute replace(v_sql,v_old,v_new);
end;
$patch$;

commit;
