-- NAXA Partie 3/6 — Accréditation Responsable
-- Additif non destructif.
-- Objectif : fermer la frontière d'accréditation Promoteur -> Responsable.
-- Responsable = fonction_interne 'responsable' + niveau interne 2.
-- Aucun nouveau role_type 'responsable' n'est créé.

create or replace function public.accrediter_responsable(
  p_target uuid,
  p_pharmacie uuid
)
returns uuid
language plpgsql
security definer
set search_path=''
as $naxa$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_arch text;
  v_max_resp integer;
  v_count integer;
  v_target_fn text;
begin
  if not public.is_admin() then
    if public.naxa_business_function(v_uid) <> 'promoteur' then
      raise exception 'Seul le Promoteur ou Admin peut accréditer un Responsable';
    end if;

    if not public.naxa_promoteur_valide(v_uid) then
      raise exception 'Promoteur commercialement invalide';
    end if;

    if not public.naxa_has_privilege('CREATE_RESPONSABLE',p_pharmacie,'PHARMACIE') then
      raise exception 'Privilège CREATE_RESPONSABLE insuffisant';
    end if;

    if not public.naxa_scope_allows(v_uid,p_pharmacie,'PHARMACIE') then
      raise exception 'Pharmacie hors périmètre Promoteur';
    end if;
  end if;

  select architecture_code,max_responsables
    into v_arch,v_max_resp
  from public.pharmacie_architectures
  where pharmacie_id=p_pharmacie and active=true;

  if v_arch is null then
    raise exception 'Architecture NAXA non assignée';
  end if;

  if not exists (
    select 1
    from public.naxa_architecture_niveaux
    where architecture_code=v_arch and niveau=2
  ) then
    raise exception 'Cette architecture ne permet pas de Responsable';
  end if;

  select public.naxa_business_function(p_target)
    into v_target_fn;

  if v_target_fn <> 'responsable' then
    raise exception 'La cible doit être une fonction Responsable';
  end if;

  if exists (
    select 1 from public.profiles
    where id=p_target and actif and niveau_interne=2 and pharmacie_id=p_pharmacie
  ) then
    raise exception 'Profil déjà accrédité Responsable dans cette pharmacie';
  end if;

  if not exists (
    select 1 from public.profiles
    where id=p_target and actif
  ) then
    raise exception 'Profil cible invalide ou inactif';
  end if;

  if not public.is_admin() and exists (
    select 1 from public.profiles
    where id=p_target
      and (pharmacie_id is not null or parent_profile_id is not null or niveau_interne is not null)
  ) then
    raise exception 'Profil cible déjà rattaché à une hiérarchie';
  end if;

  if v_max_resp is not null then
    select count(*)
      into v_count
    from public.profiles
    where pharmacie_id=p_pharmacie
      and actif=true
      and niveau_interne=2
      and public.naxa_business_function(id)='responsable';

    if v_count >= v_max_resp then
      raise exception 'Quota Responsables atteint';
    end if;
  end if;

  insert into public.profile_accreditations(
    grantor_profile_id,target_profile_id,pharmacie_id,niveau
  )
  values(v_uid,p_target,p_pharmacie,2)
  returning id into v_id;

  update public.profiles
  set parent_profile_id=v_uid,
      pharmacie_id=p_pharmacie,
      niveau_hierarchique=2,
      niveau_interne=2,
      architecture_code=v_arch,
      actif=true
  where id=p_target;

  return v_id;
end
$naxa$;

revoke all on function public.accrediter_responsable(uuid,uuid)
from public,anon,authenticated;
grant execute on function public.accrediter_responsable(uuid,uuid)
to authenticated;

-- Le point d'entrée historique reste cohérent : toute création de Responsable
-- doit passer par le même privilège CREATE_RESPONSABLE.
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
as $naxa$
declare
  v_uid uuid := (select auth.uid());
begin
  if p_niveau = 2 then
    if p_parent is null or p_parent <> v_uid then
      raise exception 'Le Promoteur doit être le parent du Responsable';
    end if;
    return public.accrediter_responsable(p_target,p_pharmacie);
  end if;

  -- Le chemin Caisse reste gouverné par les règles déjà présentes en 023/027.
  if p_niveau = 3 then
    if not public.is_admin() and public.naxa_business_function(v_uid) <> 'promoteur' then
      raise exception 'Accréditation Caisse hors périmètre Promoteur';
    end if;
    if not public.is_admin()
       and not public.naxa_promoteur_valide(v_uid) then
      raise exception 'Promoteur commercialement invalide';
    end if;
    if not public.is_admin()
       and not public.naxa_has_privilege('CREATE_CAISSE',p_pharmacie,'PHARMACIE') then
      raise exception 'Privilège CREATE_CAISSE insuffisant';
    end if;
    if not public.is_admin()
       and not public.naxa_scope_allows(v_uid,p_pharmacie,'PHARMACIE') then
      raise exception 'Pharmacie hors périmètre Promoteur';
    end if;
    if p_parent is null or p_parent <> v_uid then
      raise exception 'Le Promoteur doit être le parent de la Caisse via ce chemin';
    end if;

    return public.accrediter_responsable(p_target,p_pharmacie)
      where false;
  end if;

  raise exception 'Niveau d''accréditation invalide';
end
$naxa$;
