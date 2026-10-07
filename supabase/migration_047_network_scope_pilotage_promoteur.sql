-- NAXA — Partie 5 : scope réseau + pilotage Promoteur
-- Corrige le contrat RESEAU : pharmacie_id doit rester NULL dans les privilèges réseau.
begin;

create or replace function private.naxa_grant_privilege(
  p_target uuid,
  p_privilege text,
  p_pharmacie uuid,
  p_scope text default 'PHARMACIE'
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $body$
declare
  uid uuid := (select auth.uid());
  actor_fn text;
  target_fn text;
  target_level smallint;
  arch text;
  v_id uuid;
  is_admin_actor boolean := false;
  v_priv_pharmacie uuid := p_pharmacie;
begin
  select public.naxa_business_function(uid) into actor_fn;
  is_admin_actor := actor_fn='admin';

  select public.naxa_business_function(p_target), niveau_interne
    into target_fn,target_level
  from public.profiles
  where id=p_target and actif;

  if target_fn is null then
    raise exception 'CIBLE_INACTIVE_OU_INEXISTANTE';
  end if;

  if p_scope not in ('RESEAU','PHARMACIE','POSTE_CAISSE') then
    raise exception 'Scope de délégation invalide';
  end if;

  select architecture_code into arch
  from public.pharmacie_architectures
  where pharmacie_id=p_pharmacie and active;

  if p_scope='RESEAU' and (not is_admin_actor or target_fn<>'promoteur') then
    raise exception 'RESEAU_RESERVE_A_NAXA';
  end if;

  if p_scope='POSTE_CAISSE' and target_level<>3 then
    raise exception 'POSTE_CAISSE réservé à la Caisse';
  end if;

  if not exists(
    select 1 from public.naxa_privileges n
    where n.code=p_privilege
      and n.active
      and n.delegable
      and not n.governance
      and target_level between n.niveau_min and n.niveau_max
  ) then
    raise exception 'PRIVILEGE_NON_DELEGABLE_OU_HORS_NIVEAU';
  end if;

  if is_admin_actor then
    if p_scope in ('PHARMACIE','POSTE_CAISSE')
       and not public.naxa_can_manage_privilege_target(p_target,p_pharmacie) then
      raise exception 'CIBLE_HORS_RESEAU';
    end if;
  else
    if not public.naxa_can('ASSIGN_PRIVILEGE',p_pharmacie,p_target) then
      raise exception 'Attribution non autorisée';
    end if;
  end if;

  if p_scope='RESEAU' then
    if arch is null then raise exception 'ARCHITECTURE_PHARMACIE_MANQUANTE'; end if;
    if not exists(
      select 1 from public.naxa_architecture_privileges ap
      where ap.architecture_code=arch
        and ap.role_key='promoteur'
        and ap.privilege_code=p_privilege
    ) then
      raise exception 'Privilège hors architecture/fonction';
    end if;
    v_priv_pharmacie := null;
  else
    if arch is null then
      raise exception 'ARCHITECTURE_PHARMACIE_MANQUANTE';
    end if;
    if not exists(
      select 1 from public.naxa_architecture_privileges ap
      where ap.architecture_code=arch
        and ap.role_key=case
          when target_fn='responsable' then 'responsable'
          when target_fn='caisse' then 'caisse'
          when target_fn='promoteur' then 'promoteur'
          else null
        end
        and ap.privilege_code=p_privilege
    ) then
      raise exception 'Privilège hors architecture/fonction';
    end if;
  end if;

  insert into public.naxa_profile_privileges(
    profile_id,privilege_code,pharmacie_id,scope_type,granted_by,active,revoked_at
  )
  values(p_target,p_privilege,v_priv_pharmacie,p_scope,uid,true,null)
  on conflict(profile_id,privilege_code,pharmacie_id,scope_type)
  do update set active=true,revoked_at=null,granted_by=excluded.granted_by,granted_at=now()
  returning id into v_id;

  return v_id;
end
$body$;

create or replace function private.naxa_revoke_privilege(
  p_target uuid,
  p_privilege text,
  p_pharmacie uuid,
  p_scope text default 'PHARMACIE'
)
returns void
language plpgsql
security definer
set search_path to ''
as $body$
declare
  uid uuid := (select auth.uid());
  actor_fn text;
  v_priv_pharmacie uuid := p_pharmacie;
begin
  if exists(
    select 1 from public.naxa_privileges
    where code=p_privilege and governance
  ) then
    raise exception 'PRIVILEGE_GOUVERNANCE_NON_DELEGABLE';
  end if;

  if p_scope not in ('RESEAU','PHARMACIE','POSTE_CAISSE') then
    raise exception 'Scope de révocation invalide';
  end if;

  if p_scope='RESEAU' then
    v_priv_pharmacie := null;
  end if;

  select public.naxa_business_function(uid) into actor_fn;

  if actor_fn='admin' then
    if p_scope<>'RESEAU'
       and not public.naxa_can_manage_privilege_target(p_target,p_pharmacie) then
      raise exception 'CIBLE_HORS_RESEAU';
    end if;
  elsif not public.naxa_can('REVOKE_PRIVILEGE',p_pharmacie,p_target) then
    raise exception 'Révocation non autorisée';
  end if;

  update public.naxa_profile_privileges
  set active=false,revoked_at=now()
  where profile_id=p_target
    and privilege_code=p_privilege
    and pharmacie_id is not distinct from v_priv_pharmacie
    and scope_type=p_scope
    and active;

  if not found then
    raise exception 'Privilège introuvable';
  end if;
end
$body$;

revoke all on function public.naxa_grant_privilege(uuid,text,uuid,text) from anon;
revoke all on function public.naxa_revoke_privilege(uuid,text,uuid,text) from anon;

commit;