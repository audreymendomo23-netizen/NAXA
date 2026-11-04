-- NAXA 293 — Caisse comme poste affecté, sans convertir l'identité Auth/Client.
begin;

create or replace function public.can_operate_pharmacy(p_pharmacie uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select p_pharmacie is not null
    and public.naxa_business_function(auth.uid()) in ('admin','promoteur','responsable','pharmacie','caisse')
    and public.naxa_scope_allows(auth.uid(),p_pharmacie,'PHARMACIE')
    and exists(select 1 from public.pharmacies ph where ph.id=p_pharmacie and ph.actif=true)
$function$;

create or replace function public.naxa_caisse_actor_for_pharmacy(p_pharmacie uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select exists(
    select 1 from public.pharmacies ph
    where ph.id=p_pharmacie and ph.actif=true and ph.visible_recherche=true
  )
  and (
    public.naxa_business_function(auth.uid())='admin'
    or (
      public.naxa_business_function(auth.uid())='caisse'
      and public.naxa_scope_allows(auth.uid(),p_pharmacie,'PHARMACIE')
      and exists(select 1 from public.profiles p
        where p.id=auth.uid() and p.actif and p.pharmacie_id=p_pharmacie)
      and public.can_operate_pharmacy(p_pharmacie)
    )
  )
$function$;

create or replace function public.naxa_can_manage_team_member(
  p_target uuid,
  p_pharmacie uuid default null
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select exists(
    select 1
    from public.profiles actor
    join public.profiles target on target.id=p_target
    where actor.id=auth.uid()
      and actor.actif=true
      and target.actif=true
      and p_target<>actor.id
      and p_pharmacie is not null
      and (
        exists(
          select 1 from public.naxa_professional_assignments a
          where a.profile_id=target.id
            and a.pharmacie_id=p_pharmacie
            and a.role_code='caisse'
        )
        or (
          target.role::text='caisse'
          and target.pharmacie_id=p_pharmacie
          and target.parent_profile_id=actor.id
        )
      )
      and (
        (
          public.naxa_business_function(actor.id)='promoteur'
          and private.naxa_promoteur_valide(actor.id)
          and exists(select 1 from public.promoteur_pharmacies pp
            where pp.promoteur_id=actor.id and pp.pharmacie_id=p_pharmacie and pp.actif)
        )
        or (
          public.naxa_business_function(actor.id)='responsable'
          and actor.pharmacie_id=p_pharmacie
          and public.naxa_scope_allows(actor.id,p_pharmacie,'PHARMACIE')
        )
      )
  )
$function$;

create or replace function private.naxa_can_manage_privilege_target(
  p_target uuid,
  p_pharmacie uuid default null
)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select exists(
    select 1
    from public.profiles actor
    join public.profiles target on target.id=p_target
    where actor.id=auth.uid()
      and actor.actif=true
      and target.actif=true
      and p_target<>actor.id
      and p_pharmacie is not null
      and (
        exists(select 1 from public.naxa_professional_assignments a
          where a.profile_id=target.id and a.pharmacie_id=p_pharmacie
            and a.role_code in ('responsable','caisse')
            and a.statut='active' and a.commence_at<=now()
            and (a.expire_at is null or a.expire_at>now()))
        or (target.role::text='caisse' and target.pharmacie_id=p_pharmacie
            and target.parent_profile_id=actor.id and target.actif)
      )
      and (
        (
          public.naxa_business_function(actor.id)='promoteur'
          and private.naxa_promoteur_valide(actor.id)
          and exists(select 1 from public.promoteur_pharmacies pp
            where pp.promoteur_id=actor.id and pp.pharmacie_id=p_pharmacie and pp.actif)
        )
        or (
          public.naxa_business_function(actor.id)='responsable'
          and actor.pharmacie_id=p_pharmacie
          and public.naxa_scope_allows(actor.id,p_pharmacie,'PHARMACIE')
        )
      )
  )
$function$;

create or replace function public.naxa_can(
  p_privilege text,
  p_pharmacie uuid default null,
  p_target uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
begin
  if v_uid is null or p_privilege is null or p_pharmacie is null then return false; end if;
  if public.naxa_business_function(v_uid)='admin' then return true; end if;
  if not public.naxa_scope_allows(v_uid,p_pharmacie,'PHARMACIE') then return false; end if;
  if not public.naxa_has_privilege(p_privilege,p_pharmacie,'PHARMACIE') then return false; end if;

  if p_privilege='CREATE_CAISSE' then
    return p_target is null;
  end if;

  if p_privilege in ('SUSPEND_CAISSE','BLOCK_CAISSE') then
    return p_target is not null
      and public.naxa_can_manage_team_member(p_target,p_pharmacie)
      and exists(select 1 from public.naxa_professional_assignments a
        where a.profile_id=p_target and a.pharmacie_id=p_pharmacie
          and a.role_code='caisse' and a.statut='active'
          and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now()));
  end if;

  if p_privilege='REACTIVATE_CAISSE' then
    return p_target is not null
      and public.naxa_can_manage_team_member(p_target,p_pharmacie)
      and exists(select 1 from public.naxa_professional_assignments a
        where a.profile_id=p_target and a.pharmacie_id=p_pharmacie
          and a.role_code='caisse' and a.statut='revoked');
  end if;

  if p_target is null then return p_privilege like 'VIEW_%'; end if;
  return public.naxa_can_manage_privilege_target(p_target,p_pharmacie);
end
$function$;

create or replace function public.naxa_grant_professional_assignment(
  p_target uuid,
  p_pharmacie uuid,
  p_fonction text,
  p_commence_at timestamptz,
  p_expire_at timestamptz,
  p_motif text
)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_actor_role text;
  v_id uuid;
  v_arch text;
  v_max_caisses integer;
  v_count integer;
  v_required_privilege text;
  v_nature text;
begin
  if v_actor is null then raise exception 'Connexion requise'; end if;
  if p_target is null or p_pharmacie is null or p_target=v_actor then
    raise exception 'Cible ou pharmacie invalide';
  end if;
  if not exists(select 1 from public.naxa_roles r
    where r.code=p_fonction and r.actif and r.assignable and r.portee='PHARMACIE') then
    raise exception 'Rôle professionnel non attribuable';
  end if;
  if p_commence_at is null or p_commence_at>now()+interval '1 minute'
     or (p_expire_at is not null and p_expire_at<=greatest(p_commence_at,now())) then
    raise exception 'Période d’affectation invalide';
  end if;
  if p_motif is null or length(trim(p_motif))<5 or length(trim(p_motif))>500 then
    raise exception 'Motif obligatoire (5 à 500 caractères)';
  end if;
  if not exists(select 1 from public.profiles p where p.id=p_target and p.actif=true) then
    raise exception 'Le compte cible doit être actif';
  end if;
  if not exists(select 1 from public.pharmacies ph where ph.id=p_pharmacie and ph.actif=true) then
    raise exception 'Pharmacie inactive ou introuvable';
  end if;

  v_actor_role:=public.naxa_business_function(v_actor);
  if not public.is_admin() then
    if v_actor_role not in ('promoteur','responsable') then
      raise exception 'Affectation réservée au Promoteur ou Responsable autorisé';
    end if;
    if v_actor_role='promoteur' then
      if not private.naxa_promoteur_valide(v_actor)
         or not exists(select 1 from public.promoteur_pharmacies pp
           where pp.promoteur_id=v_actor and pp.pharmacie_id=p_pharmacie and pp.actif) then
        raise exception 'Pharmacie hors réseau Promoteur ou Promoteur invalide';
      end if;
    elsif v_actor_role='responsable' then
      if p_fonction<>'caisse'
         or not exists(select 1 from public.profiles p where p.id=v_actor and p.pharmacie_id=p_pharmacie) then
        raise exception 'Le Responsable ne peut affecter que la Caisse de sa pharmacie';
      end if;
    end if;
  end if;

  v_required_privilege:=case
    when p_fonction='caisse' then 'CREATE_CAISSE'
    when p_fonction='responsable' then 'CREATE_RESPONSABLE'
    else 'ASSIGN_USER_TO_PHARMACY'
  end;
  if not public.is_admin() then
    if p_fonction='responsable' then
      if not public.naxa_has_privilege(v_required_privilege,p_pharmacie,'PHARMACIE') then
        raise exception 'Privilège CREATE_RESPONSABLE absent';
      end if;
    elsif p_fonction='caisse' then
      if not public.naxa_can('CREATE_CAISSE',p_pharmacie,null) then
        raise exception 'Privilège CREATE_CAISSE absent';
      end if;
    elsif not public.naxa_has_privilege(v_required_privilege,p_pharmacie,'PHARMACIE') then
      raise exception 'Privilège ASSIGN_USER_TO_PHARMACY absent';
    end if;
  end if;

  select architecture_code,max_caisses into v_arch,v_max_caisses
  from public.pharmacie_architectures
  where pharmacie_id=p_pharmacie and active=true;
  if v_arch is null then raise exception 'Architecture non définie'; end if;
  if p_fonction='responsable' and v_arch not in ('PARENTS_AINES_CADETS','HYBRIDE') then
    raise exception 'Cette architecture ne permet pas de Responsable';
  end if;
  if p_fonction='caisse' and not exists(select 1 from public.naxa_architecture_niveaux
    where architecture_code=v_arch and niveau=3) then
    raise exception 'Cette architecture ne permet pas de Caisse';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_target::text||':'||p_pharmacie::text||':'||p_fonction,0));

  if exists(select 1 from public.naxa_professional_assignments a
    where a.profile_id=p_target and a.pharmacie_id=p_pharmacie
      and a.role_code=p_fonction and a.statut='active'
      and (a.expire_at is null or a.expire_at>p_commence_at)
      and (p_expire_at is null or a.commence_at<p_expire_at)) then
    raise exception 'Une affectation active de ce rôle chevauche déjà la période';
  end if;

  if p_fonction='caisse' and v_max_caisses is not null then
    select count(*) into v_count
    from public.naxa_professional_assignments a
    join public.profiles p on p.id=a.profile_id and p.actif=true
    where a.pharmacie_id=p_pharmacie and a.role_code='caisse'
      and a.statut='active' and a.commence_at<=now()
      and (a.expire_at is null or a.expire_at>now())
      and a.profile_id<>p_target;
    if v_count>=v_max_caisses then raise exception 'Quota Caisses atteint'; end if;
  end if;

  v_nature:=case when p_expire_at is null then 'ordinaire' else 'urgence' end;
  insert into public.naxa_professional_assignments(
    profile_id,pharmacie_id,fonction,role_code,statut,nature_affectation,motif,
    commence_at,expire_at,accorde_par
  ) values(
    p_target,p_pharmacie,p_fonction,p_fonction,'active',v_nature,trim(p_motif),
    p_commence_at,p_expire_at,v_actor
  ) returning id into v_id;

  return v_id;
end
$function$;

create or replace function public.naxa_revoke_professional_assignment(
  p_assignment uuid,
  p_motif text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_assignment public.naxa_professional_assignments%rowtype;
  v_actor_role text;
begin
  if v_actor is null then raise exception 'Connexion requise'; end if;
  if p_motif is null or length(trim(p_motif))<5 or length(trim(p_motif))>500 then
    raise exception 'Motif de révocation obligatoire';
  end if;
  select * into v_assignment from public.naxa_professional_assignments
  where id=p_assignment and statut='active' for update;
  if not found then raise exception 'Affectation active introuvable'; end if;

  if public.is_admin() then
    null;
  else
    v_actor_role:=public.naxa_business_function(v_actor);
    if v_actor_role='promoteur' then
      if not private.naxa_promoteur_valide(v_actor)
        or not exists(select 1 from public.promoteur_pharmacies pp
          where pp.promoteur_id=v_actor and pp.pharmacie_id=v_assignment.pharmacie_id and pp.actif) then
        raise exception 'Révocation hors réseau Promoteur';
      end if;
      if not public.naxa_has_privilege('ASSIGN_USER_TO_PHARMACY',v_assignment.pharmacie_id,'PHARMACIE')
         and v_assignment.role_code not in ('caisse','responsable') then
        raise exception 'Privilège de révocation absent';
      end if;
    elsif v_actor_role='responsable' and v_assignment.role_code='caisse' then
      if not exists(select 1 from public.profiles p where p.id=v_actor and p.pharmacie_id=v_assignment.pharmacie_id)
        or not public.naxa_can('SUSPEND_CAISSE',v_assignment.pharmacie_id,v_assignment.profile_id) then
        raise exception 'Le Responsable ne peut pas révoquer cette affectation Caisse';
      end if;
    else
      raise exception 'Révocation hors périmètre autorisé';
    end if;
  end if;

  update public.naxa_professional_assignments
  set statut='revoked',revoque_par=v_actor,revoque_at=now(),motif_revocation=trim(p_motif)
  where id=p_assignment;
  return true;
end
$function$;

create or replace function public.naxa_set_professional_assignment_status(
  p_target uuid,
  p_pharmacie uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_assignment public.naxa_professional_assignments%rowtype;
  v_arch text;
  v_max integer;
  v_count integer;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if p_target is null or p_pharmacie is null or p_target=v_uid then
    raise exception 'Cible ou pharmacie invalide';
  end if;
  if not exists(select 1 from public.profiles p where p.id=p_target and p.actif=true) then
    raise exception 'Le compte cible est inactif';
  end if;

  if p_active then
    if not public.naxa_can('REACTIVATE_CAISSE',p_pharmacie,p_target) then
      raise exception 'Réactivation Caisse non autorisée';
    end if;
    if exists(select 1 from public.naxa_professional_assignments a
      where a.profile_id=p_target and a.pharmacie_id=p_pharmacie
        and a.role_code='caisse' and a.statut='active'
        and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now())) then
      raise exception 'Une affectation Caisse est déjà active';
    end if;
    select architecture_code,max_caisses into v_arch,v_max
    from public.pharmacie_architectures where pharmacie_id=p_pharmacie and active=true;
    if v_arch is null or not exists(select 1 from public.naxa_architecture_niveaux
      where architecture_code=v_arch and niveau=3) then
      raise exception 'Architecture incompatible avec une Caisse';
    end if;
    if v_max is not null then
      select count(*) into v_count from public.naxa_professional_assignments a
      join public.profiles p on p.id=a.profile_id and p.actif
      where a.pharmacie_id=p_pharmacie and a.role_code='caisse'
        and a.statut='active' and a.commence_at<=now()
        and (a.expire_at is null or a.expire_at>now())
        and a.profile_id<>p_target;
      if v_count>=v_max then raise exception 'Quota Caisses atteint'; end if;
    end if;
    insert into public.naxa_professional_assignments(
      profile_id,pharmacie_id,fonction,role_code,statut,nature_affectation,motif,
      commence_at,expire_at,accorde_par
    ) values(
      p_target,p_pharmacie,'caisse','caisse','active','ordinaire',
      'Réactivation du poste Caisse par un gestionnaire autorisé',
      now(),null,v_uid
    );
  else
    if not public.naxa_can('SUSPEND_CAISSE',p_pharmacie,p_target) then
      raise exception 'Suspension Caisse non autorisée';
    end if;
    select * into v_assignment from public.naxa_professional_assignments a
    where a.profile_id=p_target and a.pharmacie_id=p_pharmacie
      and a.role_code='caisse' and a.statut='active'
      and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now())
    order by a.accorde_at desc,a.created_at desc
    limit 1
    for update;
    if not found then raise exception 'Affectation Caisse active introuvable'; end if;
    update public.naxa_professional_assignments
    set statut='revoked',revoque_par=v_uid,revoque_at=now(),
        motif_revocation='Suspension du poste Caisse par un gestionnaire autorisé'
    where id=v_assignment.id;
  end if;
end
$function$;

revoke all on function public.naxa_set_professional_assignment_status(uuid,uuid,boolean) from public,anon;
grant execute on function public.naxa_set_professional_assignment_status(uuid,uuid,boolean) to authenticated;

commit;
