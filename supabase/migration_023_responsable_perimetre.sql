-- NAXA 023 — périmètre Responsable
-- Additif / non destructif. Responsable = niveau 2 et supervise uniquement sa pharmacie et ses Caisses directes.

create or replace function public.naxa_can_manage_team_member(p_target uuid,p_pharmacie uuid default null)
returns boolean language sql stable security definer set search_path=''
as $$
select exists(
 select 1 from public.profiles actor
 join public.profiles target on target.id=p_target
 where actor.id=(select auth.uid()) and actor.actif
   and actor.pharmacie_id=p_pharmacie and target.pharmacie_id=p_pharmacie
   and (
     (actor.niveau_interne=2 and public.naxa_business_function(actor.id)='responsable'
      and target.niveau_interne=3 and coalesce(target.fonction_interne,case target.role::text when 'caisse' then 'caisse' else null end)='caisse'
      and target.parent_profile_id=actor.id)
     or
     (actor.niveau_interne=1 and public.naxa_business_function(actor.id)='promoteur'
      and target.niveau_interne in (2,3)
      and exists(select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=actor.id and pp.pharmacie_id=p_pharmacie and pp.actif))
   )
)
$$;

revoke all on function public.naxa_can_manage_team_member(uuid,uuid) from public,anon,authenticated;
grant execute on function public.naxa_can_manage_team_member(uuid,uuid) to authenticated;

create or replace function public.accrediter_profile(p_target uuid,p_pharmacie uuid,p_niveau smallint,p_parent uuid default null)
returns uuid language plpgsql security definer set search_path=''
as $naxa$
declare v_id uuid; v_uid uuid:=(select auth.uid()); v_actor_fn text:=public.naxa_business_function(v_uid);
v_target_fn text; v_parent_fn text; v_arch text; v_max_resp integer; v_max_caisse integer; v_count integer;
begin
 if p_parent is null or p_niveau not in (2,3) then raise exception 'Niveau ou parent invalide'; end if;
 if not exists(select 1 from public.profiles where id=v_uid and actif) then raise exception 'Acteur invalide'; end if;
 if not exists(select 1 from public.profiles where id=p_target and actif) then raise exception 'Cible invalide'; end if;

 if not public.is_admin() then
   if p_niveau=2 then
     if v_actor_fn<>'promoteur' or not public.naxa_has_privilege('CREATE_RESPONSABLE',p_pharmacie,'PHARMACIE') then raise exception 'Création Responsable non autorisée'; end if;
   elsif p_niveau=3 then
     if v_actor_fn not in ('promoteur','responsable') or not public.naxa_has_privilege('CREATE_CAISSE',p_pharmacie,'PHARMACIE') then raise exception 'Création Caisse non autorisée'; end if;
   end if;
   if not public.naxa_scope_allows(v_uid,p_pharmacie,'PHARMACIE') then raise exception 'Pharmacie hors périmètre'; end if;
 end if;

 select architecture_code,max_responsables,max_caisses into v_arch,v_max_resp,v_max_caisse
 from public.pharmacie_architectures where pharmacie_id=p_pharmacie and active=true;
 if v_arch is null then raise exception 'Architecture NAXA non assignée'; end if;
 if not exists(select 1 from public.naxa_architecture_niveaux where architecture_code=v_arch and niveau=p_niveau) then raise exception 'Niveau non autorisé par architecture %',v_arch; end if;

 select coalesce(fonction_interne,case role::text when 'caisse' then 'caisse' when 'promoteur' then 'promoteur' else null end) into v_target_fn from public.profiles where id=p_target;
 if p_niveau=2 and v_target_fn<>'responsable' then raise exception 'Niveau 2 exige fonction Responsable'; end if;
 if p_niveau=3 and v_target_fn<>'caisse' then raise exception 'Niveau 3 exige fonction Caisse'; end if;
 select public.naxa_business_function(p_parent) into v_parent_fn;
 if p_niveau=2 and v_parent_fn<>'promoteur' then raise exception 'Responsable doit avoir un Promoteur comme parent'; end if;
 if p_niveau=3 and v_parent_fn not in ('responsable','promoteur') then raise exception 'Caisse doit avoir un Responsable ou un Promoteur comme parent'; end if;
 if p_niveau=3 and v_actor_fn='responsable' and p_parent<>v_uid then raise exception 'Un Responsable ne peut accréditer que ses Caisses directes'; end if;
 if p_niveau=2 and v_actor_fn='promoteur' and p_parent<>v_uid then raise exception 'Le Promoteur doit être le parent du Responsable'; end if;

 if p_niveau=2 and v_max_resp is not null then
   select count(*) into v_count from public.profiles where pharmacie_id=p_pharmacie and actif and niveau_interne=2 and public.naxa_business_function(id)='responsable';
   if v_count>=v_max_resp then raise exception 'Quota Responsables atteint'; end if;
 end if;
 if p_niveau=3 and v_max_caisse is not null then
   select count(*) into v_count from public.profiles where pharmacie_id=p_pharmacie and actif and niveau_interne=3 and public.naxa_business_function(id)='caisse';
   if v_count>=v_max_caisse then raise exception 'Quota Caisses atteint'; end if;
 end if;

 insert into public.profile_accreditations(grantor_profile_id,target_profile_id,pharmacie_id,niveau)
 values(v_uid,p_target,p_pharmacie,p_niveau) returning id into v_id;
 update public.profiles set parent_profile_id=p_parent,pharmacie_id=p_pharmacie,niveau_interne=p_niveau,niveau_hierarchique=p_niveau,architecture_code=v_arch,actif=true where id=p_target;
 return v_id;
end
$naxa$;

revoke all on function public.accrediter_profile(uuid,uuid,smallint,uuid) from public,anon,authenticated;
grant execute on function public.accrediter_profile(uuid,uuid,smallint,uuid) to authenticated;

create or replace function public.naxa_provision_caisse(p_target uuid,p_pharmacie uuid)
returns void language plpgsql security definer set search_path=''
as $naxa$
declare uid uuid:=(select auth.uid()); actor_fn text:=public.naxa_business_function(uid); arch text; maxc integer; cnt integer;
begin
 if not public.is_admin() then
   if actor_fn not in ('promoteur','responsable') then raise exception 'Provision Caisse réservée au Promoteur ou Responsable'; end if;
   if not public.naxa_has_privilege('CREATE_CAISSE',p_pharmacie,'PHARMACIE') then raise exception 'Privilège CREATE_CAISSE insuffisant'; end if;
   if not public.naxa_scope_allows(uid,p_pharmacie,'PHARMACIE') then raise exception 'Pharmacie hors périmètre'; end if;
 end if;
 select architecture_code,max_caisses into arch,maxc from public.pharmacie_architectures where pharmacie_id=p_pharmacie and active=true;
 if arch is null then raise exception 'Architecture NAXA non assignée'; end if;
 if not exists(select 1 from public.naxa_architecture_niveaux where architecture_code=arch and niveau=3) then raise exception 'Cette architecture ne permet pas de Caisse'; end if;
 if actor_fn='responsable' and not exists(select 1 from public.profiles where id=p_target and niveau_interne=3 and coalesce(fonction_interne,case role::text when 'caisse' then 'caisse' else null end)='caisse') then raise exception 'Cible Caisse invalide'; end if;
 select count(*) into cnt from public.profiles where pharmacie_id=p_pharmacie and actif and niveau_interne=3 and public.naxa_business_function(id)='caisse';
 if maxc is not null and cnt>=maxc then raise exception 'Quota Caisses atteint'; end if;
 update public.profiles set role='caisse',fonction_interne='caisse',niveau_interne=3,niveau_hierarchique=3,pharmacie_id=p_pharmacie,parent_profile_id=uid,architecture_code=arch,actif=true where id=p_target;
 if not found then raise exception 'Compte cible introuvable'; end if;
 insert into public.naxa_profile_privileges(profile_id,privilege_code,pharmacie_id,scope_type,granted_by)
 select p_target,p.code,p_pharmacie,'POSTE_CAISSE',uid from public.naxa_privileges p
 join public.naxa_architecture_privileges ap on ap.privilege_code=p.code and ap.architecture_code=arch and ap.role_key='caisse'
 where p.active and p.code in ('VIEW_PHARMACY','VIEW_PRODUCTS','VIEW_STOCK','EDIT_STOCK_QUANTITY','VIEW_RESERVATIONS','PROCESS_RESERVATION','CONFIRM_RESERVATION','CHANGE_RESERVATION_STATUS','CANCEL_RESERVATION','VIEW_RESERVATION_HISTORY','VIEW_SALES','CREATE_SALE','CONFIRM_PAYMENT','CONFIRM_WITHDRAWAL','VIEW_SALES_HISTORY','VIEW_CAISSE_PILOTAGE','VIEW_ACTIVITY_KPI','VIEW_ALERT_KPI')
 on conflict(profile_id,privilege_code,pharmacie_id,scope_type) do update set active=true,revoked_at=null,granted_by=excluded.granted_by,granted_at=now();
end
$naxa$;

revoke all on function public.naxa_provision_caisse(uuid,uuid) from public,anon,authenticated;
grant execute on function public.naxa_provision_caisse(uuid,uuid) to authenticated;

create or replace function public.naxa_set_caisse_status(p_target uuid,p_active boolean)
returns void language plpgsql security definer set search_path=''
as $naxa$
declare pid uuid; fn text;
begin
 select pharmacie_id,coalesce(fonction_interne,case role::text when 'caisse' then 'caisse' else null end) into pid,fn from public.profiles where id=p_target;
 if fn<>'caisse' or pid is null then raise exception 'Cible Caisse invalide'; end if;
 if p_active then
   if not public.naxa_has_privilege('REACTIVATE_CAISSE',pid,'PHARMACIE') then raise exception 'Réactivation Caisse non autorisée'; end if;
 else
   if not public.naxa_has_privilege('SUSPEND_CAISSE',pid,'PHARMACIE') then raise exception 'Suspension Caisse non autorisée'; end if;
 end if;
 if not public.naxa_can_manage_team_member(p_target,pid) then raise exception 'Caisse hors périmètre de management'; end if;
 update public.profiles set actif=p_active where id=p_target;
end
$naxa$;

revoke all on function public.naxa_set_caisse_status(uuid,boolean) from public,anon,authenticated;
grant execute on function public.naxa_set_caisse_status(uuid,boolean) to authenticated;

drop policy if exists profiles_team_read on public.profiles;
create policy profiles_team_read on public.profiles for select to authenticated using (
 id=(select auth.uid()) or public.is_admin()
 or (pharmacie_id=public.my_pharmacie() and parent_profile_id=(select auth.uid()) and public.naxa_business_function((select auth.uid()))='responsable')
 or (pharmacie_id=public.my_pharmacie() and public.naxa_business_function((select auth.uid()))='promoteur')
);


-- Fermeture de la frontière RBAC : un Responsable ne peut déléguer/révoquer
-- que sur ses Caisses directes. Un Promoteur reste au-dessus du Responsable.
create or replace function public.naxa_can_manage_privilege_target(
  p_target uuid,
  p_pharmacie uuid
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
  where actor.id=(select auth.uid()) and actor.actif
    and target.pharmacie_id=p_pharmacie
    and (
      public.is_admin()
      or (
        actor.niveau_interne=2
        and public.naxa_business_function(actor.id)='responsable'
        and target.niveau_interne=3
        and coalesce(target.fonction_interne,case target.role::text when 'caisse' then 'caisse' else null end)='caisse'
        and target.parent_profile_id=actor.id
      )
      or (
        actor.niveau_interne=1
        and public.naxa_business_function(actor.id)='promoteur'
        and exists(select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=actor.id and pp.pharmacie_id=p_pharmacie and pp.actif)
        and target.niveau_interne in (2,3)
      )
    )
)
$$;

revoke all on function public.naxa_can_manage_privilege_target(uuid,uuid) from public,anon,authenticated;
grant execute on function public.naxa_can_manage_privilege_target(uuid,uuid) to authenticated;

create or replace function public.naxa_grant_privilege(
 p_target uuid,p_privilege text,p_pharmacie uuid,p_scope text default 'PHARMACIE'
)
returns uuid
language plpgsql
security definer
set search_path=''
as $naxa$
declare v_id uuid; v_level smallint; v_arch text; v_actor_fn text;
begin
 v_actor_fn:=public.naxa_business_function((select auth.uid()));
 if not public.is_admin() and not public.naxa_has_privilege('ASSIGN_PRIVILEGE',p_pharmacie,'PHARMACIE') then
   raise exception 'Attribution non autorisée';
 end if;
 if not public.naxa_can_manage_privilege_target(p_target,p_pharmacie) then
   raise exception 'Cible hors périmètre hiérarchique';
 end if;
 select niveau_interne into v_level from public.profiles where id=p_target and actif;
 if v_level is null then raise exception 'Niveau cible invalide'; end if;
 select architecture_code into v_arch from public.pharmacie_architectures where pharmacie_id=p_pharmacie and active;
 if v_arch is null then raise exception 'Architecture non définie'; end if;
 if not exists(select 1 from public.naxa_architecture_privileges where architecture_code=v_arch and role_key=case when v_level=3 then 'caisse' when v_level=2 then 'responsable' else 'promoteur' end and privilege_code=p_privilege) then
   raise exception 'Privilège hors architecture ou fonction';
 end if;
 if not exists(select 1 from public.naxa_privileges n where n.code=p_privilege and n.active and n.delegable and v_level between n.niveau_min and n.niveau_max and not n.governance) then
   raise exception 'Privilège non délégable à ce niveau';
 end if;
 if p_scope='RESEAU' and v_level<>1 then raise exception 'Scope réseau réservé au Promoteur'; end if;
 if p_scope='POSTE_CAISSE' and v_level<>3 then raise exception 'Scope poste réservé à la Caisse'; end if;
 insert into public.naxa_profile_privileges(profile_id,privilege_code,pharmacie_id,scope_type,granted_by)
 values(p_target,p_privilege,p_pharmacie,p_scope,(select auth.uid()))
 on conflict(profile_id,privilege_code,pharmacie_id,scope_type)
 do update set active=true,revoked_at=null,granted_by=excluded.granted_by,granted_at=now()
 returning id into v_id;
 return v_id;
end
$naxa$;

create or replace function public.naxa_revoke_privilege(
 p_target uuid,p_privilege text,p_pharmacie uuid,p_scope text default 'PHARMACIE'
)
returns void
language plpgsql
security definer
set search_path=''
as $naxa$
begin
 if not public.is_admin() and not public.naxa_has_privilege('REVOKE_PRIVILEGE',p_pharmacie,'PHARMACIE') then
   raise exception 'Révocation non autorisée';
 end if;
 if not public.naxa_can_manage_privilege_target(p_target,p_pharmacie) then
   raise exception 'Cible hors périmètre hiérarchique';
 end if;
 update public.naxa_profile_privileges
 set active=false,revoked_at=now()
 where profile_id=p_target
   and privilege_code=p_privilege
   and pharmacie_id is not distinct from p_pharmacie
   and scope_type=p_scope
   and active;
 if not found then raise exception 'Privilège introuvable'; end if;
end
$naxa$;

revoke all on function public.naxa_grant_privilege(uuid,text,uuid,text) from public,anon,authenticated;
revoke all on function public.naxa_revoke_privilege(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.naxa_grant_privilege(uuid,text,uuid,text) to authenticated;
grant execute on function public.naxa_revoke_privilege(uuid,text,uuid,text) to authenticated;
