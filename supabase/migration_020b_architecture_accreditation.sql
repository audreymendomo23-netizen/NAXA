-- NAXA 020.1 — fermeture des contradictions d'exécution de l'accréditation
-- Responsable = fonction_interne, jamais role_type.

create or replace function public.naxa_business_function(p_profile uuid default auth.uid())
returns text
language sql stable security definer set search_path=''
as $$
  select coalesce(
    p.fonction_interne,
    case p.role::text
      when 'admin' then 'admin'
      when 'promoteur' then 'promoteur'
      when 'caisse' then 'caisse'
      else null
    end
  )
  from public.profiles p
  where p.id=p_profile and p.actif=true
$$;

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
  if p_parent is null then raise exception 'Parent explicite requis'; end if;
  if p_niveau not in (2,3) then raise exception 'Niveau invalide'; end if;

  select architecture_code,max_responsables,max_caisses
    into v_arch,v_max_resp,v_max_caisse
  from public.pharmacie_architectures
  where pharmacie_id=p_pharmacie and active=true;

  if v_arch is null then raise exception 'Architecture NAXA non assignée'; end if;
  if not public.is_admin() and not exists (
    select 1 from public.promoteur_pharmacies
    where promoteur_id=v_uid and pharmacie_id=p_pharmacie and actif=true
  ) then
    raise exception 'Pharmacie hors périmètre Promoteur';
  end if;

  select public.naxa_business_function(p_target) into v_fn;
  if p_niveau=2 and v_fn <> 'responsable' then raise exception 'Niveau 2 exige fonction Responsable'; end if;
  if p_niveau=3 and v_fn <> 'caisse' then raise exception 'Niveau 3 exige fonction Caisse'; end if;

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

  if v_parent_fn='promoteur' and not public.is_admin() and not exists (
    select 1 from public.promoteur_pharmacies
    where promoteur_id=p_parent and pharmacie_id=p_pharmacie and actif=true
  ) then
    raise exception 'Parent Promoteur hors périmètre';
  end if;

  if p_niveau=2 then
    select count(*) into v_count from public.profiles
    where pharmacie_id=p_pharmacie and actif=true and public.naxa_business_function(id)='responsable';
    if v_max_resp is not null and v_count >= v_max_resp then
      raise exception 'Quota Responsables atteint';
    end if;
  else
    select count(*) into v_count from public.profiles
    where pharmacie_id=p_pharmacie and actif=true and public.naxa_business_function(id)='caisse';
    if v_max_caisse is not null and v_count >= v_max_caisse then
      raise exception 'Quota Caisses atteint';
    end if;
  end if;

  insert into public.profile_accreditations(grantor_profile_id,target_profile_id,pharmacie_id,niveau)
  values(v_uid,p_target,p_pharmacie,p_niveau)
  returning id into v_id;

  update public.profiles
  set parent_profile_id=p_parent,
      pharmacie_id=p_pharmacie,
      niveau_hierarchique=p_niveau,
      architecture_code=v_arch,
      actif=true
  where id=p_target;

  return v_id;
end;
$$;

revoke all on function public.accrediter_profile(uuid,uuid,smallint,uuid) from public,anon,authenticated;
grant execute on function public.accrediter_profile(uuid,uuid,smallint,uuid) to authenticated;
