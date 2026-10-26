begin;

-- Un compte administrateur désactivé ne doit conserver ni les autorisations applicatives
-- ni les privilèges délégués par les politiques RLS/RPC qui reposent sur is_admin().
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and actif is true
  )
$function$;

commit;
