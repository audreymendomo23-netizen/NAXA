begin;

-- The function already schema-qualifies every object; an empty search_path
-- removes unnecessary object-resolution risk from this SECURITY DEFINER helper.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
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
