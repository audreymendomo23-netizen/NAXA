-- NAXA 151 — façades RPC invoker pour les opérations hiérarchiques.
-- Les mutations restent dans des fonctions privées SECURITY DEFINER avec gardes métier.
create or replace function private.naxa_provision_caisse(
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

create or replace function private.naxa_set_caisse_status(
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

create or replace function private.accrediter_profile(p_target uuid,p_pharmacie uuid,p_niveau smallint,p_parent uuid default null)
returns uuid language plpgsql security definer set search_path='' as $naxa$
declare v_id uuid; v_uid uuid:=(select auth.uid()); v_actor_fn text:=public.naxa_business_function(v_uid); v_target_fn text; v_parent_fn text; v_arch text; v_max_resp integer; v_max_caisse integer; v_count integer;
begin
 if p_parent is null or p_niveau not in (2,3) then raise exception 'Niveau ou parent invalide'; end if;
 if not exists(select 1 from public.profiles where id=v_uid and actif) then raise exception 'Acteur invalide'; end if;
 if not exists(select 1 from public.profiles where id=p_target and actif) then raise exception 'Cible invalide'; end if;
 if not public.is_admin() then
   if v_actor_fn<>'promoteur' then raise exception 'Accréditation non autorisée'; end if;
   if not public.naxa_promoteur_valide(v_uid) then raise exception 'Promoteur commercialement invalide'; end if;
   if not public.naxa_scope_allows(v_uid,p_pharmacie,'PHARMACIE') then raise exception 'Pharmacie hors périmètre'; end if;
   if p_niveau=2 and not public.naxa_has_privilege('CREATE_RESPONSABLE',p_pharmacie,'PHARMACIE') then raise exception 'Privilège CREATE_RESPONSABLE insuffisant'; end if;
   if p_niveau=3 and not public.naxa_has_privilege('CREATE_CAISSE',p_pharmacie,'PHARMACIE') then raise exception 'Privilège CREATE_CAISSE insuffisant'; end if;
 end if;
 select architecture_code,max_responsables,max_caisses into v_arch,v_max_resp,v_max_caisse from public.pharmacie_architectures where pharmacie_id=p_pharmacie and active;
 if v_arch is null then raise exception 'Architecture NAXA non assignée'; end if;
 if p_niveau=2 and v_arch not in ('PARENTS_AINES_CADETS','HYBRIDE') then raise exception 'Cette architecture ne permet pas de Responsable'; end if;
 select public.naxa_business_function(p_target) into v_target_fn;
 if p_niveau=2 and v_target_fn<>'responsable' then raise exception 'Niveau 2 exige fonction Responsable'; end if;
 if p_niveau=3 and v_target_fn<>'caisse' then raise exception 'Niveau 3 exige fonction Caisse'; end if;
 select public.naxa_business_function(p_parent) into v_parent_fn;
 if p_niveau=2 and v_parent_fn<>'promoteur' then raise exception 'Responsable doit avoir un Promoteur comme parent'; end if;
 if p_niveau=3 and v_parent_fn not in ('responsable','promoteur') then raise exception 'Caisse doit avoir un Responsable ou un Promoteur comme parent'; end if;
 if p_niveau=2 and v_actor_fn='promoteur' and p_parent<>v_uid then raise exception 'Le Promoteur doit être le parent du Responsable'; end if;
 if p_niveau=3 and v_actor_fn='responsable' and p_parent<>v_uid then raise exception 'Un Responsable ne peut accréditer que ses Caisses directes'; end if;
 if v_parent_fn='promoteur' and not public.is_admin() and not public.naxa_promoteur_valide(p_parent) then raise exception 'Parent Promoteur commercialement invalide'; end if;
 if v_parent_fn='promoteur' and not public.is_admin() and not exists(select 1 from public.promoteur_pharmacies where promoteur_id=p_parent and pharmacie_id=p_pharmacie and actif) then raise exception 'Parent Promoteur hors périmètre'; end if;
 if p_niveau=2 then select count(*) into v_count from public.profiles where pharmacie_id=p_pharmacie and actif and niveau_interne=2 and public.naxa_business_function(id)='responsable'; if v_max_resp is not null and v_count>=v_max_resp then raise exception 'Quota Responsables atteint'; end if;
 else select count(*) into v_count from public.profiles where pharmacie_id=p_pharmacie and actif and niveau_interne=3 and public.naxa_business_function(id)='caisse'; if v_max_caisse is not null and v_count>=v_max_caisse then raise exception 'Quota Caisses atteint'; end if; end if;
 insert into public.profile_accreditations(grantor_profile_id,target_profile_id,pharmacie_id,niveau) values(v_uid,p_target,p_pharmacie,p_niveau) returning id into v_id;
 update public.profiles set parent_profile_id=p_parent,pharmacie_id=p_pharmacie,niveau_interne=p_niveau,niveau_hierarchique=p_niveau,architecture_code=v_arch,actif=true where id=p_target;
 return v_id;
end $naxa$;

create or replace function public.naxa_provision_caisse(p_target uuid,p_pharmacie uuid)
returns void language sql set search_path=''
as $facade$ select private.naxa_provision_caisse($1,$2) $facade$;

create or replace function public.naxa_set_caisse_status(p_target uuid,p_active boolean)
returns void language sql set search_path=''
as $facade$ select private.naxa_set_caisse_status($1,$2) $facade$;

create or replace function public.accrediter_profile(p_target uuid,p_pharmacie uuid,p_niveau smallint,p_parent uuid default null)
returns uuid language sql set search_path=''
as $facade$ select private.accrediter_profile($1,$2,$3,$4) $facade$;

create or replace function public.accrediter_responsable(p_target uuid,p_pharmacie uuid)
returns uuid language sql set search_path=''
as $facade$ select public.accrediter_profile($1,$2,2::smallint,(select auth.uid())) $facade$;

revoke all on function private.naxa_provision_caisse(uuid,uuid) from public,anon;
grant execute on function private.naxa_provision_caisse(uuid,uuid) to authenticated;
revoke all on function private.naxa_set_caisse_status(uuid,boolean) from public,anon;
grant execute on function private.naxa_set_caisse_status(uuid,boolean) to authenticated;
revoke all on function private.accrediter_profile(uuid,uuid,smallint,uuid) from public,anon;
grant execute on function private.accrediter_profile(uuid,uuid,smallint,uuid) to authenticated;

revoke all on function public.naxa_provision_caisse(uuid,uuid) from public,anon;
grant execute on function public.naxa_provision_caisse(uuid,uuid) to authenticated;
revoke all on function public.naxa_set_caisse_status(uuid,boolean) from public,anon;
grant execute on function public.naxa_set_caisse_status(uuid,boolean) to authenticated;
revoke all on function public.accrediter_profile(uuid,uuid,smallint,uuid) from public,anon;
grant execute on function public.accrediter_profile(uuid,uuid,smallint,uuid) to authenticated;
revoke all on function public.accrediter_responsable(uuid,uuid) from public,anon;
grant execute on function public.accrediter_responsable(uuid,uuid) to authenticated;
