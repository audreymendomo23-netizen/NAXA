-- NAXA 296 — aligner le RBAC Stock, pilotage et décisions sur le poste actif.
begin;

do $patch$
declare
  v_sql text;
  v_old text;
  v_new text;
begin
  -- Le pilotage ne se base plus sur profiles.role / fonction_interne.
  v_sql:=pg_get_functiondef('private.stats_pilotage_scope(integer)'::regprocedure);
  v_old:=$old$
  select p.role::text,p.fonction_interne
    into v_role,v_fonction
  from public.profiles p
  where p.id=uid and p.actif=true;
$old$;
  v_new:=$new$
  v_role:=public.naxa_business_function(uid);
  v_fonction:=v_role;
$new$;
  if position(v_old in v_sql)=0 then raise exception 'Lecture du rôle pilotage introuvable'; end if;
  v_sql:=replace(v_sql,v_old,v_new);

  v_old:=$old$elsif v_role='pharmacie' and v_fonction='responsable' then$old$;
  v_new:=$new$elsif v_role='responsable' then$new$;
  if position(v_old in v_sql)=0 then raise exception 'Branche pilotage Responsable introuvable'; end if;
  v_sql:=replace(v_sql,v_old,v_new);

  v_old:=$old$                                      (select pharmacie_id from public.profiles where id=uid),
                                      'PHARMACIE')$old$;
  v_new:=$new$                                      public.naxa_active_role_pharmacy(uid),
                                      'PHARMACIE')$new$;
  if position(v_old in v_sql)=0 then raise exception 'Scope pilotage Responsable introuvable'; end if;
  v_sql:=replace(v_sql,v_old,v_new);

  v_old:=$old$    select coalesce(array_agg(p.pharmacie_id),'{}'::uuid[]) into v_pharmacies
    from public.profiles p where p.id=uid and p.pharmacie_id is not null;$old$;
  v_new:=$new$    if public.naxa_active_role_pharmacy(uid) is null then
      raise exception 'Pharmacie du poste Responsable introuvable';
    end if;
    v_pharmacies:=array[public.naxa_active_role_pharmacy(uid)];$new$;
  if position(v_old in v_sql)=0 then raise exception 'Périmètre pilotage Responsable introuvable'; end if;
  v_sql:=replace(v_sql,v_old,v_new);

  v_old:=$old$if not public.naxa_has_privilege('VIEW_CAISSE_PILOTAGE',
                                      public.naxa_active_role_pharmacy(uid),
                                      'PHARMACIE') then$old$;
  v_new:=$new$if not public.naxa_has_privilege('VIEW_CAISSE_PILOTAGE',
                                      public.naxa_active_role_pharmacy(uid),
                                      'POSTE_CAISSE') then$new$;
  if position(v_old in v_sql)=0 then raise exception 'Contrôle pilotage Caisse introuvable'; end if;
  v_sql:=replace(v_sql,v_old,v_new);
  execute v_sql;

  -- Helper commun du gestionnaire Stock : seuls les rôles sélectionnés comptent.
  v_sql:=pg_get_functiondef('public.naxa_stock_manager_actor(uuid)'::regprocedure);
  v_old:=$old$select auth.uid() is not null
 and public.naxa_scope_allows(auth.uid(),p_pharmacie,'PHARMACIE')
 and exists(select 1 from public.profiles p where p.id=auth.uid() and p.actif=true
  and (coalesce(p.role::text,'') in ('admin','promoteur')
   or coalesce(p.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')));$old$;
  v_new:=$new$select auth.uid() is not null
 and public.naxa_scope_allows(auth.uid(),p_pharmacie,'PHARMACIE')
 and public.naxa_business_function(auth.uid()) in
   ('admin','promoteur','pharmacien','responsable','gestionnaire_stock','magasinier');$new$;
  if position(v_old in v_sql)=0 then raise exception 'Helper Stock actif introuvable'; end if;
  execute replace(v_sql,v_old,v_new);

  -- Prise de service Stock basée sur le poste actif et son scope.
  v_sql:=pg_get_functiondef('public.stock_service_open(uuid,text)'::regprocedure);
  v_old:=$old$  select lower(coalesce(p.role,'')),lower(coalesce(p.fonction_interne,''))
    into v_role,v_fonction
  from public.profiles p where p.id=auth.uid() and p.actif is distinct from false;
  if not found then raise exception 'Profil actif requis'; end if;$old$;
  v_new:=$new$  v_role:=public.naxa_business_function(auth.uid());
  v_fonction:=v_role;
  if v_role is null then raise exception 'Poste actif requis'; end if;$new$;
  if position(v_old in v_sql)=0 then raise exception 'Résolution du poste prise de service introuvable'; end if;
  v_sql:=replace(v_sql,v_old,v_new);

  v_old:=$old$    v_role='admin'
    or v_role='promoteur'
    or v_fonction in ('gestionnaire_stock','magasinier')
    or v_assigned$old$;
  v_new:=$new$    v_role in ('admin','promoteur','gestionnaire_stock','magasinier')
    or v_assigned$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde rôle prise de service introuvable'; end if;
  v_sql:=replace(v_sql,v_old,v_new);

  v_old:=$old$    v_role='admin'
    or private.naxa_scope_allows(auth.uid(),p_pharmacie,'PHARMACIE')
    or v_assigned$old$;
  v_new:=$new$    private.naxa_scope_allows(auth.uid(),p_pharmacie,'PHARMACIE')
    or v_assigned$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde scope prise de service introuvable'; end if;
  execute replace(v_sql,v_old,v_new);

  -- Les quatre opérations Stock ne consultent plus le miroir legacy.
  foreach v_old in array array[
    $old$coalesce(v_profile.role::text,'') in ('admin','promoteur')
   or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')$old$,
    $old$coalesce(v_profile.role::text,'') in ('admin','promoteur')
       or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')$old$
  ]
  loop
    v_new:=$new$public.naxa_business_function(v_user) in
     ('admin','promoteur','pharmacien','responsable','gestionnaire_stock','magasinier')$new$;
    foreach v_sql in array array[
      pg_get_functiondef('public.stock_emplacement_modifier(uuid,uuid,text)'::regprocedure),
      pg_get_functiondef('public.stock_lot_blocage_modifier(uuid,boolean,text)'::regprocedure),
      pg_get_functiondef('public.stock_lot_emplacement_modifier(uuid,text)'::regprocedure)
    ]
    loop
      if position(v_old in v_sql)>0 then
        execute replace(v_sql,v_old,v_new);
      end if;
    end loop;
  end loop;

  -- Déclarer un lot est interdit si le poste sélectionné est Caisse,
  -- quelle que soit l'identité Auth de la personne.
  v_sql:=pg_get_functiondef('public.stock_lot_enregistrer(uuid,uuid,text,date,integer,uuid)'::regprocedure);
  v_old:=$old$  if not found
     or coalesce(v_profile.role::text,'')='caisse'
     or coalesce(v_profile.fonction_interne,'')='caisse'
     or not (
       coalesce(v_profile.role::text,'') in ('admin','promoteur')
       or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
       or public.naxa_has_privilege('MANAGE_LOTS',p_pharmacie,'PHARMACIE')
       or v_assigned
     ) then$old$;
  v_new:=$new$  if not found
     or public.naxa_business_function(v_user)='caisse'
     or not (
       public.naxa_business_function(v_user) in
         ('admin','promoteur','pharmacien','responsable','gestionnaire_stock','magasinier')
       or public.naxa_has_privilege('MANAGE_LOTS',p_pharmacie,'PHARMACIE')
       or v_assigned
     ) then$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde rôle création lot introuvable'; end if;
  execute replace(v_sql,v_old,v_new);
end;
$patch$;

-- Caisse : conserver l'ancienne signature publique mais ne jamais convertir le rôle Auth.
create or replace function public.naxa_provision_caisse(p_target uuid,p_pharmacie uuid)
returns void
language plpgsql
security definer
set search_path=''
as $function$
begin
  perform public.naxa_grant_professional_assignment(
    p_target,
    p_pharmacie,
    'caisse',
    now(),
    null,
    'Attribution du poste Caisse via la compatibilité RPC NAXA.'
  );
end;
$function$;

-- Le rôle actif définit le droit de gestion de profil et le niveau Promoteur.
create or replace function public.can_manage_profile(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select
    public.is_admin()
    or (
      public.naxa_business_function(auth.uid())='promoteur'
      and private.naxa_promoteur_valide(auth.uid())
      and exists(
        select 1 from public.profiles t
        where t.id=p_target and t.actif=true
          and t.parent_profile_id=auth.uid()
      )
    )
$function$;

-- Les décisions sur les remises/annulations n'acceptent plus un Promoteur
-- uniquement parce que le profil Auth possède un niveau historique.
do $patch$
declare
  v_sql text;
  v_old text;
  v_new text;
begin
  v_sql:=pg_get_functiondef('public.vente_annulation_decider(uuid,boolean)'::regprocedure);
  v_old:=$old$  if not public.is_admin() and not exists (
    select 1 from public.profiles p
    where p.id=auth.uid() and p.actif and p.role::text='promoteur' and p.niveau_interne=1
  ) then raise exception 'Décision réservée au Promoteur ou à NAXA'; end if;$old$;
  v_new:=$new$  if not public.is_admin()
    and (public.naxa_business_function(auth.uid())<>'promoteur'
      or not private.naxa_promoteur_valide(auth.uid())) then
    raise exception 'Décision réservée au Promoteur valide ou à NAXA';
  end if;$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde Promoteur annulation introuvable'; end if;
  v_sql:=replace(v_sql,v_old,v_new);
  execute replace(v_sql,
    $old$  if not public.is_admin() and not public.can_access_pharmacy(v_demande.pharmacie_id) then raise exception 'Demande hors périmètre'; end if;$old$,
    $new$  if not public.is_admin() and not public.naxa_scope_allows(auth.uid(),v_demande.pharmacie_id,'PHARMACIE') then raise exception 'Demande hors périmètre'; end if;$new$);

  v_sql:=pg_get_functiondef('public.vente_remise_decider(uuid,boolean)'::regprocedure);
  v_old:=$old$ if not public.is_admin() and not exists(select 1 from public.profiles p where p.id=auth.uid() and p.actif and p.role::text='promoteur' and p.niveau_interne=1) then
   raise exception 'Décision réservée au Promoteur ou NAXA'; end if;$old$;
  v_new:=$new$ if not public.is_admin()
    and (public.naxa_business_function(auth.uid())<>'promoteur'
      or not private.naxa_promoteur_valide(auth.uid())) then
   raise exception 'Décision réservée au Promoteur valide ou à NAXA';
 end if;$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde Promoteur remise introuvable'; end if;
  v_sql:=replace(v_sql,v_old,v_new);
  execute replace(v_sql,
    $old$ if not public.is_admin() and not public.can_access_pharmacy(r.pharmacie_id) then raise exception 'Hors périmètre'; end if;$old$,
    $new$ if not public.is_admin() and not public.naxa_scope_allows(auth.uid(),r.pharmacie_id,'PHARMACIE') then raise exception 'Hors périmètre'; end if;$new$);
end;
$patch$;

-- Les opérations réservées à NAXA exigent le poste Admin actif, pas seulement
-- un profil dont le rôle Auth historique est admin.
do $patch$
declare
  v_name text;
  v_sql text;
  v_old text;
  v_new text;
  v_names text[]:=array[
    'public.admin_avis_rappel_lot_diffuser(text,text,text,text,text)',
    'public.admin_set_exam_center_status(uuid,text)',
    'public.admin_set_exam_pack_status(uuid,text)',
    'public.admin_set_exam_service_status(uuid,text)',
    'public.admin_set_home_service_offer_status(uuid,text)',
    'public.admin_set_partner_universe(uuid,text,boolean)',
    'public.admin_set_universe_enabled(text,boolean)'
  ];
begin
  foreach v_name in array v_names loop
    v_sql:=pg_get_functiondef(v_name::regprocedure);
    v_old:=$old$not exists(select 1 from public.profiles p where p.id=auth.uid() and p.role::text='admin' and p.actif=true)$old$;
    v_new:=$new$not public.is_admin()$new$;
    if position(v_old in v_sql)>0 then
      execute replace(v_sql,v_old,v_new);
    else
      v_old:=$old$not exists(select 1 from public.profiles p where p.id=v_actor and p.role='admin')$old$;
      v_new:=$new$not public.is_admin()$new$;
      if position(v_old in v_sql)>0 then
        execute replace(v_sql,v_old,v_new);
      else
        v_old:=$old$not exists(select 1 from public.profiles p where p.id=uid and p.role='admin')$old$;
        if position(v_old in v_sql)>0 then
          execute replace(v_sql,v_old,v_new);
        else
          raise exception 'Garde admin incompatible avec le poste actif : %',v_name;
        end if;
      end if;
    end if;
  end loop;

  v_sql:=pg_get_functiondef('public.admin_confirmer_reglement_promoteur(uuid,uuid)'::regprocedure);
  v_old:=$old$if not exists(select 1 from public.profiles where id=p_admin and role::text='admin' and actif=true) then$old$;
  v_new:=$new$if p_admin is distinct from auth.uid() or not public.is_admin() then$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde admin confirmation règlement introuvable'; end if;
  execute replace(v_sql,v_old,v_new);

  v_sql:=pg_get_functiondef('public.admin_enregistrer_reglement_promoteur(uuid,integer,text,text,text,timestamptz,text,uuid)'::regprocedure);
  v_old:=$old$if not exists(select 1 from public.profiles where id=p_admin and role::text='admin' and actif=true) then$old$;
  v_new:=$new$if p_admin is distinct from auth.uid() or not public.is_admin() then$new$;
  if position(v_old in v_sql)=0 then raise exception 'Garde admin saisie règlement introuvable'; end if;
  execute replace(v_sql,v_old,v_new);
end;
$patch$;

-- L'Admin des partenaires et de l'import catalogue suit la même règle.
do $patch$
declare
  v_sql text;
  v_old text;
  v_new text;
begin
  v_sql:=pg_get_functiondef('public.partner_adjust_universe_stock(uuid,numeric,text,text)'::regprocedure);
  v_old:=$old$not exists ( select 1 from public.profiles p where p.id=uid and p.role='admin' )$old$;
  v_new:=$new$not public.is_admin()$new$;
  if position(v_old in v_sql)=0 then raise exception 'Bypass admin stock partenaire introuvable'; end if;
  execute replace(v_sql,v_old,v_new);

  v_sql:=pg_get_functiondef('public.partner_import_universe_products(uuid,text,jsonb)'::regprocedure);
  v_old:=$old$not exists(select 1 from public.profiles p where p.id=uid and p.role='admin')$old$;
  v_new:=$new$not public.is_admin()$new$;
  if position(v_old in v_sql)=0 then raise exception 'Bypass admin import partenaire introuvable'; end if;
  execute replace(v_sql,v_old,v_new);
end;
$patch$;

commit;
