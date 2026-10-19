-- NAXA 135 — aligner les gardes d'attribution avec la révocation.
-- Additif : conserve le modèle de délégation et refuse les paramètres ambigus.

create or replace function private.naxa_grant_privilege(
  p_target uuid,
  p_privilege text,
  p_pharmacie uuid,
  p_scope text default 'PHARMACIE'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  uid uuid := (select auth.uid());
  actor_fn text;
  target_fn text;
  arch text;
  v_level smallint;
  v_id uuid;
begin
  if uid is null then
    raise exception 'Authentification requise';
  end if;

  if p_target is null
     or p_privilege is null
     or btrim(p_privilege) = ''
     or p_pharmacie is null
     or p_scope is null
     or p_scope not in ('PHARMACIE','POSTE_CAISSE') then
    raise exception 'Paramètres d’attribution invalides';
  end if;

  select public.naxa_business_function(uid) into actor_fn;
  if actor_fn is null then
    raise exception 'Fonction métier de l’acteur introuvable';
  end if;
  if actor_fn = 'admin' then
    raise exception 'Le privilège de gouvernance se gère hors délégation';
  end if;
  if actor_fn = 'promoteur' and not public.naxa_promoteur_valide(uid) then
    raise exception 'Promoteur commercialement invalide';
  end if;
  if not exists (select 1 from public.profiles where id=uid and actif=true) then
    raise exception 'Compte inactif';
  end if;

  select public.naxa_business_function(p_target), niveau_interne
    into target_fn, v_level
  from public.profiles
  where id=p_target and actif=true;

  if target_fn is null or v_level is null then
    raise exception 'Cible inactive ou fonction métier invalide';
  end if;

  if not public.naxa_can('ASSIGN_PRIVILEGE',p_pharmacie,p_target) then
    raise exception 'Attribution non autorisée';
  end if;

  if p_scope='POSTE_CAISSE' and v_level<>3 then
    raise exception 'POSTE_CAISSE réservé à la Caisse';
  end if;

  if not exists (
    select 1 from public.naxa_privileges n
    where n.code=p_privilege
      and n.active=true
      and n.delegable=true
      and n.governance=false
      and n.governance_only is not true
      and v_level between n.niveau_min and n.niveau_max
  ) then
    raise exception 'Privilège non délégable, de gouvernance ou hors niveau';
  end if;

  select architecture_code into arch
  from public.pharmacie_architectures
  where pharmacie_id=p_pharmacie and active=true;

  if arch is null then
    raise exception 'Architecture non définie';
  end if;

  if not exists (
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

  insert into public.naxa_profile_privileges(
    profile_id,privilege_code,pharmacie_id,scope_type,granted_by,active,revoked_at
  ) values(p_target,p_privilege,p_pharmacie,p_scope,uid,true,null)
  on conflict(profile_id,privilege_code,pharmacie_id,scope_type)
  do update set active=true,revoked_at=null,granted_by=excluded.granted_by,granted_at=now()
  returning id into v_id;

  return v_id;
end
$function$;

