-- NAXA 029 — Promoteur Partie 4 : gestion Caisse / quotas / périmètre
-- Canonical target gate used by privilege delegation/revocation.
-- The actor may manage only direct descendants in the same pharmacy and only
-- for functions strictly below its own level.
create or replace function private.naxa_can_manage_privilege_target(
  p_target uuid,
  p_pharmacie uuid default null
)
returns boolean
language sql
stable
security definer
set search_path=''
as $fn$
  select exists (
    select 1
    from public.profiles actor
    join public.profiles target on target.id=p_target
    where actor.id=(select auth.uid())
      and actor.actif
      and target.actif
      and p_target <> actor.id
      and target.pharmacie_id=p_pharmacie
      and (
        (
          public.naxa_business_function(actor.id)='promoteur'
          and target.parent_profile_id=actor.id
          and public.naxa_business_function(target.id) in ('responsable','caisse')
          and exists (
            select 1 from public.promoteur_pharmacies pp
            where pp.promoteur_id=actor.id
              and pp.pharmacie_id=p_pharmacie
              and pp.actif
          )
        )
        or
        (
          public.naxa_business_function(actor.id)='responsable'
          and target.parent_profile_id=actor.id
          and public.naxa_business_function(target.id)='caisse'
        )
      )
  )
$fn$;

revoke all on function private.naxa_can_manage_privilege_target(uuid,uuid) from public,anon,authenticated;
grant execute on function private.naxa_can_manage_privilege_target(uuid,uuid) to authenticated;

create or replace function public.naxa_can_manage_privilege_target(
  p_target uuid,
  p_pharmacie uuid default null
)
returns boolean
language sql
stable
security definer
set search_path=''
as $fn$
  select private.naxa_can_manage_privilege_target($1,$2)
$fn$;

revoke all on function public.naxa_can_manage_privilege_target(uuid,uuid) from public,anon,authenticated;
grant execute on function public.naxa_can_manage_privilege_target(uuid,uuid) to authenticated;

-- Additif non destructif. Ferme les entrées latérales de provisionnement et de statut.

create or replace function public.naxa_can_manage_team_member(
  p_target uuid,
  p_pharmacie uuid default null
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
select exists(
  select 1
  from public.profiles actor
  join public.profiles target on target.id=p_target
  where actor.id=(select auth.uid())
    and actor.actif
    and target.pharmacie_id=p_pharmacie
    and (
      (
        actor.niveau_interne=2
        and coalesce(public.naxa_business_function(actor.id),case actor.role::text when 'promoteur' then 'promoteur' when 'responsable' then 'responsable' when 'caisse' then 'caisse' else null end)='responsable'
        and target.niveau_interne=3
        and coalesce(public.naxa_business_function(target.id),case target.role::text when 'promoteur' then 'promoteur' when 'responsable' then 'responsable' when 'caisse' then 'caisse' else null end)='caisse'
        and target.parent_profile_id=actor.id
      )
      or
      (
        actor.niveau_interne=1
        and coalesce(public.naxa_business_function(actor.id),case actor.role::text when 'promoteur' then 'promoteur' when 'responsable' then 'responsable' when 'caisse' then 'caisse' else null end)='promoteur'
        and target.niveau_interne=3
        and coalesce(public.naxa_business_function(target.id),case target.role::text when 'promoteur' then 'promoteur' when 'responsable' then 'responsable' when 'caisse' then 'caisse' else null end)='caisse'
        and target.parent_profile_id=actor.id
        and exists(
          select 1
          from public.promoteur_pharmacies pp
          where pp.promoteur_id=actor.id
            and pp.pharmacie_id=p_pharmacie
            and pp.actif
        )
      )
    )
)
$$;

revoke all on function public.naxa_can_manage_team_member(uuid,uuid) from public,anon,authenticated;
grant execute on function public.naxa_can_manage_team_member(uuid,uuid) to authenticated;

create or replace function public.naxa_provision_caisse(
  p_target uuid,
  p_pharmacie uuid
)
returns void
language plpgsql
security definer
set search_path=''
as $naxa$
declare
  uid uuid := (select auth.uid());
  actor_fn text := public.naxa_business_function(uid);
  arch text;
  maxc integer;
  cnt integer;
  target_fn text;
  target_parent uuid;
begin
  if uid is null then raise exception 'Acteur non authentifié'; end if;

  if public.is_admin() then
    null;
  elsif actor_fn='promoteur' then
    if not public.naxa_promoteur_valide(uid) then
      raise exception 'Promoteur commercialement invalide';
    end if;
    if not public.naxa_can('CREATE_CAISSE',p_pharmacie,null) then
      raise exception 'Privilège CREATE_CAISSE insuffisant';
    end if;
  elsif actor_fn='responsable' then
    if not public.naxa_can('CREATE_CAISSE',p_pharmacie,null) then
      raise exception 'Privilège CREATE_CAISSE insuffisant';
    end if;
  else
    raise exception 'Provision Caisse réservée au Promoteur ou Responsable';
  end if;

  if p_target=uid then raise exception 'Un acteur ne peut pas se provisionner lui-même comme Caisse'; end if;

  if not public.naxa_scope_allows(uid,p_pharmacie,'PHARMACIE') and not public.is_admin() then
    raise exception 'Pharmacie hors périmètre';
  end if;

  select architecture_code,max_caisses
    into arch,maxc
  from public.pharmacie_architectures
  where pharmacie_id=p_pharmacie and active=true;

  if arch is null then raise exception 'Architecture NAXA non assignée'; end if;
  if not exists(
    select 1 from public.naxa_architecture_niveaux
    where architecture_code=arch and niveau=3
  ) then
    raise exception 'Cette architecture ne permet pas de Caisse';
  end if;

  select coalesce(fonction_interne,case role::text when 'caisse' then 'caisse' else null end),parent_profile_id
    into target_fn,target_parent
  from public.profiles
  where id=p_target;

  if target_fn is null then raise exception 'Compte cible introuvable'; end if;
  if target_fn<>'caisse' then raise exception 'La cible doit déjà être une Caisse'; end if;

  -- Provisionner une Caisse est une opération d'affectation initiale, jamais une
  -- réactivation déguisée. Une Caisse déjà rattachée passe obligatoirement par
  -- naxa_set_caisse_status(..., true) et donc REACTIVATE_CAISSE.
  if exists(select 1 from public.profiles where id=p_target and (pharmacie_id is not null or parent_profile_id is not null)) then
    raise exception 'Caisse déjà provisionnée : utiliser la réactivation dédiée';
  end if;

  -- Première affectation : une Caisse vierge n'a pas encore de parent.
  -- Si un parent existe déjà, il doit obligatoirement être l'acteur appelant.
  if not public.is_admin()
     and target_parent is not null
     and target_parent is distinct from uid then
    raise exception 'Caisse hors périmètre hiérarchique direct';
  end if;

  select count(*) into cnt
  from public.profiles
  where pharmacie_id=p_pharmacie
    and actif
    and niveau_interne=3
    and public.naxa_business_function(id)='caisse'
    and id<>p_target;

  if maxc is not null and cnt>=maxc and not exists(
    select 1 from public.profiles where id=p_target and pharmacie_id=p_pharmacie and actif
  ) then
    raise exception 'Quota Caisses atteint';
  end if;

  update public.profiles
  set role='caisse',
      fonction_interne='caisse',
      niveau_interne=3,
      niveau_hierarchique=3,
      pharmacie_id=p_pharmacie,
      parent_profile_id=uid,
      architecture_code=arch,
      actif=true
  where id=p_target;

  if not found then raise exception 'Compte cible introuvable'; end if;
end
$naxa$;

revoke all on function public.naxa_provision_caisse(uuid,uuid) from public,anon,authenticated;
grant execute on function public.naxa_provision_caisse(uuid,uuid) to authenticated;

create or replace function public.naxa_set_caisse_status(
  p_target uuid,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path=''
as $naxa$
declare
  pid uuid;
  fn text;
  parent_id uuid;
  arch text;
  maxc integer;
  cnt integer;
begin
  select pharmacie_id,
         public.naxa_business_function(id),
         parent_profile_id
    into pid,fn,parent_id
  from public.profiles
  where id=p_target;

  if fn<>'caisse' or pid is null then
    raise exception 'Cible Caisse invalide';
  end if;

  if not public.naxa_can_manage_team_member(p_target,pid) then
    raise exception 'Caisse hors périmètre de management';
  end if;

  if p_active then
    if not public.naxa_can('REACTIVATE_CAISSE',pid,p_target) then
      raise exception 'Réactivation Caisse non autorisée';
    end if;

    select architecture_code,max_caisses into arch,maxc
    from public.pharmacie_architectures
    where pharmacie_id=pid and active=true;

    if arch is null or not exists(
      select 1 from public.naxa_architecture_niveaux
      where architecture_code=arch and niveau=3
    ) then
      raise exception 'Architecture incompatible avec une Caisse';
    end if;

    select count(*) into cnt
    from public.profiles
    where pharmacie_id=pid
      and actif
      and niveau_interne=3
      and public.naxa_business_function(id)='caisse'
      and id<>p_target;

    if maxc is not null and cnt>=maxc then
      raise exception 'Quota Caisses atteint';
    end if;
  else
    if not public.naxa_can('SUSPEND_CAISSE',pid,p_target) then
      raise exception 'Suspension Caisse non autorisée';
    end if;
  end if;

  update public.profiles set actif=p_active where id=p_target;
end
$naxa$;

revoke all on function public.naxa_set_caisse_status(uuid,boolean) from public,anon,authenticated;
grant execute on function public.naxa_set_caisse_status(uuid,boolean) to authenticated;
