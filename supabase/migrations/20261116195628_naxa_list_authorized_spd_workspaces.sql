
create or replace function public.naxa_list_accessible_spd_workspaces()
returns table(partner_id uuid,partner_name text,member_role text)
language sql
stable
security definer
set search_path = ''
as $function$
  select pa.id,pa.name,pm.member_role
  from public.partner_members pm
  join public.partners pa on pa.id=pm.partner_id
    and pa.partner_type='professionnel_domicile'
    and pa.status='active'
  join public.partner_universes pu on pu.partner_id=pa.id
    and pu.universe_slug='prestations'
    and pu.enabled=true
  join public.profiles member_profile on member_profile.id=pm.user_id
    and member_profile.actif=true
  where auth.uid() is not null
    and pm.user_id=auth.uid()
    and pm.member_role in ('owner','manager','operator')
    and private.naxa_partner_has_confirmed_payment(pa.id)
  order by pa.name,pa.id;
$function$;

revoke all on function public.naxa_list_accessible_spd_workspaces() from public,anon;
grant execute on function public.naxa_list_accessible_spd_workspaces() to authenticated;
comment on function public.naxa_list_accessible_spd_workspaces() is
  'Returns only active, paid SPD workspaces already assigned to the authenticated NAXA identity.';
