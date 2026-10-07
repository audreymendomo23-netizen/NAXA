-- NAXA — Pilotage 360° Partie 3 : durcissement sécurité + réseau
-- Corrige deux contradictions du moteur canonique :
-- 1) après la réconciliation 048, les Responsable/Caisse étaient refusés par naxa_has_privilege()
--    car la fonction appelait naxa_promoteur_valide(NULL) pour les profils non-Promoteur ;
-- 2) un Admin pouvait attribuer un privilège RESEAU à un Promoteur en fournissant une pharmacie
--    hors de son réseau actif.
begin;

create or replace function private.naxa_has_privilege(
  p_uid uuid,
  p_privilege text,
  p_pharmacie uuid,
  p_scope text
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $body$
  select exists(
    select 1
    from public.naxa_profile_privileges pp
    join public.naxa_privileges p on p.code=pp.privilege_code
    join public.profiles u on u.id=pp.profile_id
    where pp.profile_id=p_uid
      and pp.privilege_code=p_privilege
      and pp.active
      and p.active
      and u.actif
      and pp.scope_type=p_scope
      and pp.pharmacie_id is not distinct from case when p_scope='RESEAU' then null else p_pharmacie end
      and (
        (
          p_scope='RESEAU'
          and u.role::text='promoteur'
          and private.naxa_promoteur_valide(u.id)
        )
        or
        (
          p_scope in ('PHARMACIE','POSTE_CAISSE')
          and u.pharmacie_id=p_pharmacie
          and exists(
            with recursive lineage(id,parent_profile_id,role_name) as (
              select p0.id,p0.parent_profile_id,p0.role::text
              from public.profiles p0
              where p0.id=u.id
              union all
              select p1.id,p1.parent_profile_id,p1.role::text
              from public.profiles p1
              join lineage l on l.parent_profile_id=p1.id
            )
            select 1
            from lineage l
            where l.role_name='promoteur'
              and private.naxa_promoteur_valide(l.id)
              and exists(
                select 1
                from public.promoteur_pharmacies ppn
                where ppn.promoteur_id=l.id
                  and ppn.pharmacie_id=p_pharmacie
                  and ppn.actif
              )
          )
        )
      )
  );
$body$;

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

  if target_fn is null then raise exception 'CIBLE_INACTIVE_OU_INEXISTANTE'; end if;
  if p_scope not in ('RESEAU','PHARMACIE','POSTE_CAISSE') then raise exception 'Scope de délégation invalide'; end if;
  if p_scope='RESEAU' and (not is_admin_actor or target_fn<>'promoteur') then raise exception 'RESEAU_RESERVE_A_NAXA'; end if;
  if p_scope='POSTE_CAISSE' and target_level<>3 then raise exception 'POSTE_CAISSE réservé à la Caisse'; end if;

  if not exists(
    select 1 from public.naxa_privileges n
    where n.code=p_privilege and n.active and n.delegable and not n.governance
      and target_level between n.niveau_min and n.niveau_max
  ) then raise exception 'PRIVILEGE_NON_DELEGABLE_OU_HORS_NIVEAU'; end if;

  if is_admin_actor then
    if p_scope='RESEAU' then
      if not exists(
        select 1
        from public.promoteur_pharmacies pp
        join public.pharmacies ph on ph.id=pp.pharmacie_id
        where pp.promoteur_id=p_target
          and pp.pharmacie_id=p_pharmacie
          and pp.actif
          and ph.actif
      ) then
        raise exception 'RESEAU_CIBLE_HORS_RESEAU';
      end if;
    elsif not public.naxa_can_manage_privilege_target(p_target,p_pharmacie) then
      raise exception 'CIBLE_HORS_RESEAU';
    end if;
  else
    if not public.naxa_can('ASSIGN_PRIVILEGE',p_pharmacie,p_target) then raise exception 'Attribution non autorisée'; end if;
  end if;

  select architecture_code into arch
  from public.pharmacie_architectures
  where pharmacie_id=p_pharmacie and active;

  if arch is null then raise exception 'ARCHITECTURE_PHARMACIE_MANQUANTE'; end if;

  if p_scope='RESEAU' then
    if not exists(
      select 1 from public.naxa_architecture_privileges ap
      where ap.architecture_code=arch
        and ap.role_key='promoteur'
        and ap.privilege_code=p_privilege
        and ap.active
    ) then raise exception 'Privilège hors architecture/fonction'; end if;
    v_priv_pharmacie := null;
  else
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
        and ap.active
    ) then raise exception 'Privilège hors architecture/fonction'; end if;
  end if;

  insert into public.naxa_profile_privileges(
    profile_id,privilege_code,pharmacie_id,scope_type,granted_by,active,revoked_at
  )
  values(p_target,p_privilege,v_priv_pharmacie,p_scope,uid,true,null)
  on conflict(profile_id,privilege_code,pharmacie_id,scope_type)
  do update set
    active=true,revoked_at=null,granted_by=excluded.granted_by,granted_at=now()
  returning id into v_id;

  return v_id;
end
$body$;

revoke execute on function public.naxa_grant_privilege(uuid,text,uuid,text) from public,anon;
revoke execute on function public.naxa_revoke_privilege(uuid,text,uuid,text) from public,anon;

commit;
