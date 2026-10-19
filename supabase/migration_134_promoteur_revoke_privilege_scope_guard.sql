-- NAXA 134 — contrôler la cible avant toute révocation de privilège.
-- Migration additive : conserve les attributions et leur historique.

create or replace function public.naxa_revoke_privilege(
  p_target uuid,
  p_privilege text,
  p_pharmacie uuid,
  p_scope text default 'PHARMACIE'
)
returns void
language plpgsql
security definer
set search_path = ''
as $naxa$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
begin
  if v_uid is null then raise exception 'Authentification requise'; end if;
  if p_target is null or p_privilege is null or btrim(p_privilege) = ''
     or p_scope is null
     or p_scope not in ('RESEAU','PHARMACIE','POSTE_CAISSE') then
    raise exception 'Paramètres de révocation invalides';
  end if;

  if not public.is_admin() then
    if p_pharmacie is null then raise exception 'Pharmacie de contrôle requise'; end if;

    select role::text into v_role
    from public.profiles
    where id=v_uid and actif=true;
    if v_role is null then raise exception 'Compte inactif'; end if;

    if v_role='promoteur' and not public.naxa_promoteur_valide(v_uid) then
      raise exception 'Promoteur commercialement invalide';
    end if;

    if not public.naxa_has_privilege('REVOKE_PRIVILEGE',p_pharmacie,'PHARMACIE') then
      raise exception 'Privilège de révocation absent';
    end if;

    -- Un Promoteur ne peut retirer que des droits ordinaires explicitement
    -- délégables ; les privilèges de gouvernance restent réservés à l'admin.
    if not exists (
      select 1
      from public.naxa_privileges n
      where n.code = p_privilege
        and n.active = true
        and n.delegable = true
        and n.governance = false
        and n.governance_only is not true
    ) then
      raise exception 'Privilège non délégable ou de gouvernance';
    end if;

    if p_scope='RESEAU' then
      if v_role<>'promoteur' or p_target<>v_uid
         or not public.naxa_scope_allows(v_uid,p_pharmacie,'RESEAU') then
        raise exception 'Révocation réseau hors périmètre';
      end if;
    elsif not public.naxa_can_manage_privilege_target(p_target,p_pharmacie) then
      raise exception 'Cible hors périmètre hiérarchique';
    end if;
  end if;

  update public.naxa_profile_privileges
     set active=false, revoked_at=now()
   where profile_id=p_target
     and privilege_code=p_privilege
     and pharmacie_id is not distinct from
         case when p_scope='RESEAU' then null::uuid else p_pharmacie end
     and scope_type=p_scope and active=true and revoked_at is null;

  if not found then raise exception 'Privilège actif introuvable'; end if;
end
$naxa$;

revoke all on function public.naxa_revoke_privilege(uuid,text,uuid,text) from public,anon;
grant execute on function public.naxa_revoke_privilege(uuid,text,uuid,text) to authenticated;
