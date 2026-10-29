-- NAXA — harden SECURITY DEFINER helpers used by RLS and consent checks.
-- Function bodies use schema-qualified relations; result and permission semantics are unchanged.
begin;

create or replace function public.can_access_pharmacy(p_pharmacie uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select p_pharmacie is not null
    and exists (select 1 from public.my_pharmacies() x where x = p_pharmacie)
$function$;

create or replace function public.suivi_has_consent(p_user_id uuid, p_family text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.suivi_consents c
    where c.user_id=p_user_id
      and c.family_key=p_family
      and c.granted=true
      and c.granted_at is not null
      and c.revoked_at is null
  )
$function$;

commit;
