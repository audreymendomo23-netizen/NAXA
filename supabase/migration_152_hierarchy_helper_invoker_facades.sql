-- NAXA 152 — façades invoker pour les helpers de management hiérarchique.
create or replace function private.naxa_can_manage_team_member(
  p_target uuid,
  p_pharmacie uuid default null
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
  where actor.id=(select auth.uid())
    and actor.actif
    and target.pharmacie_id=p_pharmacie
    and (
      (
        actor.niveau_interne=2
        and coalesce(public.naxa_business_function(actor.id),case actor.role::text when 'promoteur' then 'promoteur' when 'responsable' then 'responsable' when 'caisse' then 'caisse' else null end)='responsable'
        and target.niveau_interne=3
        and coalesce(public.naxa_business_function(target.id),case target.role::text when 'promoteur' then 'promoteur' when 'responsable' then 'responsable' when 'caisse' then 'caisse' else null end)='caisse'
        and target.parent_profile_id=actor.id
      )
      or
      (
        actor.niveau_interne=1
        and coalesce(public.naxa_business_function(actor.id),case actor.role::text when 'promoteur' then 'promoteur' when 'responsable' then 'responsable' when 'caisse' then 'caisse' else null end)='promoteur'
        and target.niveau_interne=3
        and coalesce(public.naxa_business_function(target.id),case target.role::text when 'promoteur' then 'promoteur' when 'responsable' then 'responsable' when 'caisse' then 'caisse' else null end)='caisse'
        and target.parent_profile_id=actor.id
        and exists(
          select 1
          from public.promoteur_pharmacies pp
          where pp.promoteur_id=actor.id
            and pp.pharmacie_id=p_pharmacie
            and pp.actif
        )
      )
    )
)
$$;

create or replace function public.naxa_can_manage_team_member(p_target uuid,p_pharmacie uuid default null)
returns boolean language sql set search_path=''
as $facade$ select private.naxa_can_manage_team_member($1,$2) $facade$;

create or replace function public.naxa_can_manage_privilege_target(p_target uuid,p_pharmacie uuid default null)
returns boolean language sql set search_path=''
as $facade$ select private.naxa_can_manage_privilege_target($1,$2) $facade$;

revoke all on function private.naxa_can_manage_team_member(uuid,uuid) from public,anon;
grant execute on function private.naxa_can_manage_team_member(uuid,uuid) to authenticated;
revoke all on function public.naxa_can_manage_team_member(uuid,uuid) from public,anon;
grant execute on function public.naxa_can_manage_team_member(uuid,uuid) to authenticated;
revoke all on function public.naxa_can_manage_privilege_target(uuid,uuid) from public,anon;
grant execute on function public.naxa_can_manage_privilege_target(uuid,uuid) to authenticated;
