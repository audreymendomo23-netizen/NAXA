-- NAXA 034 — autorisations Promoteur/Caisses alignées sur le schéma réellement déployé
-- Ferme le dernier écart : les actions création/blocage/réactivation doivent
-- toutes passer par le même moteur d'autorisation DB.
-- Aucun moteur d'architecture de privilèges non déployé n'est introduit ici.

create or replace function public.naxa_can(
  p_privilege text,
  p_pharmacie uuid default null,
  p_target uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_actor_role text;
  v_actor_pharmacie uuid;
begin
  if v_uid is null or p_privilege is null or p_pharmacie is null then
    return false;
  end if;

  select p.role::text, p.pharmacie_id
    into v_actor_role, v_actor_pharmacie
  from public.profiles p
  where p.id = v_uid
    and p.actif = true;

  if v_actor_role is null then
    return false;
  end if;

  if v_actor_role = 'admin' then
    return true;
  end if;

  if v_actor_role <> 'promoteur'
     or v_actor_pharmacie is null
     or p_pharmacie <> v_actor_pharmacie then
    return false;
  end if;

  if p_privilege = 'CREATE_CAISSE' then
    return p_target is null;
  end if;

  if p_target is null then
    return false;
  end if;

  if p_privilege = 'BLOCK_CAISSE' then
    return exists (
      select 1
      from public.profiles t
      where t.id = p_target
        and t.role::text = 'caisse'
        and t.pharmacie_id = v_actor_pharmacie
        and t.parent_profile_id = v_uid
        and t.actif = true
    );
  end if;

  if p_privilege = 'REACTIVATE_CAISSE' then
    return exists (
      select 1
      from public.profiles t
      where t.id = p_target
        and t.role::text = 'caisse'
        and t.pharmacie_id = v_actor_pharmacie
        and t.parent_profile_id = v_uid
        and t.actif = false
    );
  end if;

  return false;
end;
$$;

revoke all on function public.naxa_can(text,uuid,uuid) from public, anon;
grant execute on function public.naxa_can(text,uuid,uuid) to authenticated;
