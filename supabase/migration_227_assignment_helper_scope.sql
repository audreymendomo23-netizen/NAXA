-- NAXA 227 — limiter la consultation du helper d'affectation à soi-même ou Admin.
begin;
create or replace function public.naxa_has_active_professional_assignment(
  p_profile uuid,
  p_pharmacie uuid,
  p_fonction text
) returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_profile is not null
    and p_pharmacie is not null
    and p_fonction is not null
    and (p_profile = (select auth.uid()) or (select public.is_admin()))
    and exists (
      select 1
      from public.naxa_professional_assignments a
      join public.profiles p on p.id = a.profile_id and p.actif = true
      join public.pharmacies ph on ph.id = a.pharmacie_id and ph.actif = true
      where a.profile_id = p_profile
        and a.pharmacie_id = p_pharmacie
        and a.fonction = p_fonction
        and a.statut = 'active'
        and a.commence_at <= now()
        and a.expire_at > now()
    );
$function$;
revoke all on function public.naxa_has_active_professional_assignment(uuid,uuid,text) from public, anon;
grant execute on function public.naxa_has_active_professional_assignment(uuid,uuid,text) to authenticated;
commit;
