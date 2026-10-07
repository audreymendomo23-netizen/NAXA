-- NAXA 027 — Promoteur : architecture + convention + validité
-- Partie 2/6. Additif non destructif.
-- Contradiction fermée : un Promoteur actif pouvait conserver des privilèges opérationnels
-- après expiration/résiliation de sa convention/abonnement. La validité commerciale devient
-- une barrière explicite du moteur d'autorisation, sans modifier le scope réseau de la Partie 1.

create or replace function public.naxa_promoteur_valide(p_promoteur uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists (
    select 1
    from public.profiles p
    join public.conventions_promoteurs c
      on c.promoteur_id=p.id
    join public.abonnements_promoteurs a
      on a.promoteur_id=p.id
     and a.convention_id=c.id
    where p.id=p_promoteur
      and p.role='promoteur'
      and p.actif
      and c.statut='active'
      and c.date_expiration >= current_date
      and a.statut='actif'
      and a.echeance >= current_date
  );
$$;

revoke all on function public.naxa_promoteur_valide(uuid) from public,anon,authenticated;
grant execute on function public.naxa_promoteur_valide(uuid) to authenticated;

-- Cohérence canonique : un abonnement ne peut jamais pointer vers la convention
-- d'un autre Promoteur.
create or replace function public.verifier_abonnement_promoteur_coherence()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if not exists (
    select 1
    from public.conventions_promoteurs c
    where c.id=new.convention_id
      and c.promoteur_id=new.promoteur_id
  ) then
    raise exception 'Convention Promoteur incohérente avec l''abonnement';
  end if;

  if new.statut='actif' and new.echeance < current_date then
    raise exception 'Un abonnement Promoteur actif ne peut pas être échu';
  end if;

  return new;
end;
$$;

revoke all on function public.verifier_abonnement_promoteur_coherence() from public,anon,authenticated;

drop trigger if exists trg_verifier_abonnement_promoteur_coherence
on public.abonnements_promoteurs;

create trigger trg_verifier_abonnement_promoteur_coherence
before insert or update of promoteur_id,convention_id,statut,echeance
on public.abonnements_promoteurs
for each row
execute function public.verifier_abonnement_promoteur_coherence();

-- Le moteur canonique de privilèges bloque désormais tout Promoteur commercialement invalide.
-- Reconciliation avec le moteur d'autorisation canonique.
create or replace function private.naxa_can(p_privilege text,p_pharmacie uuid default null,p_target uuid default null)
returns boolean language plpgsql stable security definer set search_path=''
as $function$
declare uid uuid := (select auth.uid()); fn text; pid uuid := p_pharmacie; target_role text; target_fn text;
begin
 if uid is null or p_privilege is null then return false; end if;
 select public.naxa_business_function(uid) into fn;
 if fn is null then return false; end if;
 if fn='admin' then return true; end if;
 if fn='promoteur' and not public.naxa_promoteur_valide(uid) then return false; end if;
 if pid is null then select pharmacie_id into pid from public.profiles where id=uid; end if;
 if not public.naxa_has_privilege(p_privilege,pid,case when fn='promoteur' and p_pharmacie is null and p_privilege in ('VIEW_NETWORK_PILOTAGE','VIEW_NETWORK_REPORT','VIEW_NETWORK_HEALTH','VIEW_CA_BY_PHARMACY','VIEW_COMPARISON') then 'RESEAU' else 'PHARMACIE' end) then return false; end if;
 if p_target is null then return true; end if;
 select public.naxa_business_function(p_target) into target_fn;
 select role::text into target_role from public.profiles where id=p_target;
 if p_privilege in ('CREATE_RESPONSABLE','CREATE_CAISSE') then return false; end if;
 if p_privilege in ('MANAGE_RESPONSABLES','SUSPEND_RESPONSABLE','REACTIVATE_RESPONSABLE') then return fn='promoteur' and target_fn='responsable' and exists(select 1 from public.profiles t where t.id=p_target and t.pharmacie_id=pid); end if;
 if p_privilege in ('MANAGE_CAISSES','SUSPEND_CAISSE','REACTIVATE_CAISSE') then return ((fn='promoteur' and target_fn='caisse' and exists(select 1 from public.profiles t where t.id=p_target and t.pharmacie_id=pid)) or (fn='responsable' and target_fn='caisse' and exists(select 1 from public.profiles t where t.id=p_target and t.pharmacie_id=pid and t.parent_profile_id=uid))); end if;
 if p_privilege in ('ASSIGN_PRIVILEGE','REVOKE_PRIVILEGE','VIEW_USER_PRIVILEGES') then return public.naxa_can_manage_privilege_target(p_target,pid); end if;
 return exists(select 1 from public.profiles t where t.id=p_target and t.pharmacie_id=pid and t.actif);
end
$function$;
create or replace function public.naxa_can(p_privilege text,p_pharmacie uuid default null,p_target uuid default null)
returns boolean language sql stable set search_path='' as $$ select private.naxa_can($1,$2,$3) $$;
revoke all on function public.naxa_can(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.naxa_can(text,uuid,uuid) to authenticated;
-- Une accréditation Promoteur/Responsable/Caisse ne peut pas être lancée par un
-- Promoteur dont la convention est expirée/résiliée.
create or replace function public.accrediter_profile(
  p_target uuid,
  p_pharmacie uuid,
  p_niveau smallint,
  p_parent uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_fn text;
  v_parent_fn text;
  v_arch text;
  v_max_resp integer;
  v_max_caisse integer;
  v_count integer;
  v_uid uuid := (select auth.uid());
begin
  if not public.is_admin() and not public.is_promoteur() then
    raise exception 'Accréditation non autorisée';
  end if;
  if public.is_promoteur() and not public.naxa_promoteur_valide(v_uid) then
    raise exception 'Promoteur commercialement invalide';
  end if;
  if p_parent is null then raise exception 'Parent explicite requis'; end if;
  if p_niveau not in (2,3) then raise exception 'Niveau invalide'; end if;

  select architecture_code,max_responsables,max_caisses
    into v_arch,v_max_resp,v_max_caisse
  from public.pharmacie_architectures
  where pharmacie_id=p_pharmacie and active=true;

  if v_arch is null then raise exception 'Architecture NAXA non assignée'; end if;

  if not public.is_admin() and not exists (
    select 1 from public.promoteur_pharmacies
    where promoteur_id=v_uid
      and pharmacie_id=p_pharmacie
      and actif=true
  ) then
    raise exception 'Pharmacie hors périmètre Promoteur';
  end if;

  select public.naxa_business_function(p_target) into v_fn;
  if p_niveau=2 and v_fn <> 'responsable' then
    raise exception 'Niveau 2 exige fonction Responsable';
  end if;
  if p_niveau=3 and v_fn <> 'caisse' then
    raise exception 'Niveau 3 exige fonction Caisse';
  end if;

  if p_niveau=2 and v_arch not in ('PARENTS_AINES_CADETS','HYBRIDE') then
    raise exception 'Cette architecture ne permet pas de Responsable';
  end if;

  select public.naxa_business_function(p_parent) into v_parent_fn;
  if p_niveau=2 and v_parent_fn <> 'promoteur' then
    raise exception 'Responsable doit avoir un Promoteur comme parent';
  end if;
  if p_niveau=3 and v_parent_fn not in ('responsable','promoteur') then
    raise exception 'Caisse doit avoir un Responsable ou un Promoteur comme parent';
  end if;

  if v_parent_fn='promoteur'
     and not public.is_admin()
     and not public.naxa_promoteur_valide(p_parent) then
    raise exception 'Parent Promoteur commercialement invalide';
  end if;

  if v_parent_fn='promoteur'
     and not public.is_admin()
     and not exists (
       select 1 from public.promoteur_pharmacies
       where promoteur_id=p_parent
         and pharmacie_id=p_pharmacie
         and actif=true
     ) then
    raise exception 'Parent Promoteur hors périmètre';
  end if;

  if p_niveau=2 then
    select count(*) into v_count
    from public.profiles
    where pharmacie_id=p_pharmacie
      and actif=true
      and public.naxa_business_function(id)='responsable';
    if v_max_resp is not null and v_count >= v_max_resp then
      raise exception 'Quota Responsables atteint';
    end if;
  else
    select count(*) into v_count
    from public.profiles
    where pharmacie_id=p_pharmacie
      and actif=true
      and public.naxa_business_function(id)='caisse';
    if v_max_caisse is not null and v_count >= v_max_caisse then
      raise exception 'Quota Caisses atteint';
    end if;
  end if;

  insert into public.profile_accreditations(
    grantor_profile_id,target_profile_id,pharmacie_id,niveau
  )
  values(v_uid,p_target,p_pharmacie,p_niveau)
  returning id into v_id;

  update public.profiles
  set parent_profile_id=p_parent,
      pharmacie_id=p_pharmacie,
      niveau_hierarchique=p_niveau,
      niveau_interne=p_niveau,
      architecture_code=v_arch,
      actif=true
  where id=p_target;

  return v_id;
end;
$$;

revoke all on function public.accrediter_profile(uuid,uuid,smallint,uuid)
from public,anon;
grant execute on function public.accrediter_profile(uuid,uuid,smallint,uuid)
to authenticated;

-- Le provisioning ne doit pas réactiver silencieusement les privilèges d'un Promoteur
-- dont la validité commerciale est terminée.
create or replace function public.naxa_provision_promoteur_pharmacie(
  p_promoteur uuid,
  p_pharmacie uuid
)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_arch text;
  v_count integer := 0;
begin
  if not public.naxa_promoteur_valide(p_promoteur) then
    raise exception 'Promoteur commercialement invalide';
  end if;

  if not exists (
    select 1 from public.profiles
    where id=p_promoteur
      and role='promoteur'
      and actif
      and niveau_interne=1
  ) then
    raise exception 'Profil Promoteur invalide';
  end if;

  select architecture_code into v_arch
  from public.pharmacie_architectures
  where pharmacie_id=p_pharmacie and active;

  if v_arch is null then
    raise exception 'Architecture NAXA non définie pour la pharmacie';
  end if;

  if not exists (
    select 1 from public.promoteur_pharmacies
    where promoteur_id=p_promoteur
      and pharmacie_id=p_pharmacie
      and actif
  ) then
    raise exception 'Lien Promoteur/pharmacie inactif ou absent';
  end if;

  insert into public.naxa_profile_privileges(
    profile_id,privilege_code,pharmacie_id,scope_type,granted_by
  )
  select
    p_promoteur,ap.privilege_code,p_pharmacie,'PHARMACIE',p_promoteur
  from public.naxa_architecture_privileges ap
  join public.naxa_privileges n on n.code=ap.privilege_code
  where ap.architecture_code=v_arch
    and ap.role_key='promoteur'
    and n.active
    and not n.governance
    and n.delegable
  on conflict(profile_id,privilege_code,pharmacie_id,scope_type)
  do update set active=true,revoked_at=null,granted_by=excluded.granted_by,granted_at=now();

  insert into public.naxa_profile_privileges(
    profile_id,privilege_code,pharmacie_id,scope_type,granted_by
  )
  select
    p_promoteur,ap.privilege_code,null,'RESEAU',p_promoteur
  from public.naxa_architecture_privileges ap
  join public.naxa_privileges n on n.code=ap.privilege_code
  where ap.architecture_code=v_arch
    and ap.role_key='promoteur'
    and n.active
    and not n.governance
    and n.delegable
    and ap.privilege_code in (
      'VIEW_NETWORK_PILOTAGE','VIEW_NETWORK_REPORT','VIEW_NETWORK_HEALTH',
      'VIEW_CA_BY_PHARMACY','VIEW_COMPARISON'
    )
  on conflict(profile_id,privilege_code,pharmacie_id,scope_type)
  do update set active=true,revoked_at=null,granted_by=excluded.granted_by,granted_at=now();

  get diagnostics v_count=row_count;
  return v_count;
end;
$$;

revoke all on function public.naxa_provision_promoteur_pharmacie(uuid,uuid)
from public,anon,authenticated;

-- Les fonctions de synchronisation restent réservées au moteur de validité/service.
