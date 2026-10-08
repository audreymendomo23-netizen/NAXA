-- NAXA 030 — Promoteur Partie 4 : fermeture délégation / statut / validité commerciale
-- Additif non destructif. Toute attribution opérationnelle passe par naxa_can().

create or replace function private.naxa_has_privilege(p_privilege text,p_pharmacie uuid default null,p_scope text default 'PHARMACIE')
returns boolean language plpgsql stable security definer set search_path=''
as $function$
declare uid uuid := (select auth.uid()); fn text; v_role_key text; arch text; target_pharmacy uuid := p_pharmacie;
begin
 if uid is null or p_privilege is null then return false; end if;
 if not exists(select 1 from public.naxa_privileges n where n.code=p_privilege and n.active) then return false; end if;
 select public.naxa_business_function(uid) into fn;
 if fn is null then return false; end if;
 if fn='admin' then return true; end if;
 if fn='promoteur' and not public.naxa_promoteur_valide(uid) then return false; end if;
 if p_scope not in ('RESEAU','PHARMACIE','POSTE_CAISSE') then return false; end if;
 if target_pharmacy is null then select pharmacie_id into target_pharmacy from public.profiles where id=uid; end if;
 if p_scope='RESEAU' then
   if fn <> 'promoteur' then return false; end if;
   return exists(select 1 from public.naxa_profile_privileges pp where pp.profile_id=uid and pp.privilege_code=p_privilege and pp.scope_type='RESEAU' and pp.pharmacie_id is null and pp.active);
 end if;
 if target_pharmacy is null then return false; end if;
 if not public.naxa_scope_allows(uid,target_pharmacy,p_scope) then return false; end if;
 select pa.architecture_code into arch from public.pharmacie_architectures pa where pa.pharmacie_id=target_pharmacy and pa.active;
 if arch is null then return false; end if;
 v_role_key:=case when fn in ('promoteur','responsable','caisse') then fn else null end;
 if v_role_key is not null then
   if not exists(select 1 from public.naxa_architecture_privileges ap where ap.architecture_code=arch and ap.role_key=v_role_key and ap.privilege_code=p_privilege) then return false; end if;
 else
   if not exists(select 1 from public.profiles p join public.naxa_custom_roles cr on cr.pharmacie_id=target_pharmacy and cr.code=p.custom_role_code and cr.actif join public.naxa_custom_role_privileges cp on cp.custom_role_id=cr.id where p.id=uid and cp.privilege_code=p_privilege) then return false; end if;
 end if;
 return exists(select 1 from public.naxa_profile_privileges pp where pp.profile_id=uid and pp.privilege_code=p_privilege and pp.pharmacie_id=target_pharmacy and pp.scope_type=p_scope and pp.active);
end
$function$;

create or replace function public.naxa_has_privilege(
  p_privilege text,
  p_pharmacie uuid default null,
  p_scope text default 'PHARMACIE'
)
returns boolean
language sql
stable
security definer
set search_path=''
as $fn$
  select private.naxa_has_privilege($1,$2,$3)
$fn$;

revoke all on function public.naxa_has_privilege(text,uuid,text) from public,anon,authenticated;
grant execute on function public.naxa_has_privilege(text,uuid,text) to authenticated;

create or replace function public.naxa_grant_privilege(
 p_target uuid,p_privilege text,p_pharmacie uuid,p_scope text default 'PHARMACIE'
)
returns uuid
language plpgsql
security definer
set search_path=''
as $naxa$
declare
 v_id uuid;
 v_level smallint;
 v_arch text;
begin
 if not public.is_admin()
    and public.naxa_business_function((select auth.uid()))='promoteur'
    and not public.naxa_promoteur_valide((select auth.uid())) then
   raise exception 'Promoteur commercialement invalide';
 end if;

 if not public.is_admin()
    and not public.naxa_can('ASSIGN_PRIVILEGE',p_pharmacie,p_target) then
   raise exception 'Attribution non autorisée';
 end if;

 if not public.naxa_can_manage_privilege_target(p_target,p_pharmacie) then
   raise exception 'Cible hors périmètre hiérarchique';
 end if;

 if not public.is_admin()
    and not exists(select 1 from public.profiles where id=p_target and actif) then
   raise exception 'Cible inactive';
 end if;

 select niveau_interne into v_level
 from public.profiles
 where id=p_target and actif;

 if v_level is null then raise exception 'Niveau cible invalide'; end if;

 select architecture_code into v_arch
 from public.pharmacie_architectures
 where pharmacie_id=p_pharmacie and active;

 if v_arch is null then raise exception 'Architecture non définie'; end if;

 if not exists(
   select 1
   from public.naxa_architecture_privileges
   where architecture_code=v_arch
     and role_key=case when v_level=3 then 'caisse' when v_level=2 then 'responsable' else 'promoteur' end
     and privilege_code=p_privilege
 ) then
   raise exception 'Privilège hors architecture ou fonction';
 end if;

 if not exists(
   select 1
   from public.naxa_privileges n
   where n.code=p_privilege
     and n.active
     and n.delegable
     and v_level between n.niveau_min and n.niveau_max
     and not n.governance
 ) then
   raise exception 'Privilège non délégable à ce niveau';
 end if;

 if p_scope='RESEAU' and v_level<>1 then
   raise exception 'Scope réseau réservé au Promoteur';
 end if;

 if p_scope='POSTE_CAISSE' and v_level<>3 then
   raise exception 'Scope poste réservé à la Caisse';
 end if;

 insert into public.naxa_profile_privileges(profile_id,privilege_code,pharmacie_id,scope_type,granted_by)
 values(p_target,p_privilege,p_pharmacie,p_scope,(select auth.uid()))
 on conflict(profile_id,privilege_code,pharmacie_id,scope_type)
 do update set active=true,revoked_at=null,granted_by=excluded.granted_by,granted_at=now()
 returning id into v_id;

 return v_id;
end
$naxa$;

revoke all on function public.naxa_grant_privilege(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.naxa_grant_privilege(uuid,text,uuid,text) to authenticated;
