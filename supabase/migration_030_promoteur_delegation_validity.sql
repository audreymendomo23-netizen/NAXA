-- NAXA 030 — Promoteur Partie 4 : fermeture délégation / statut / validité commerciale
-- Additif non destructif. Toute attribution opérationnelle passe par naxa_can().

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
