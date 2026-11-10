-- Make the canonical Admin predicate non-null.
-- A NULL boolean is unsafe in PL/pgSQL IF NOT / OR guards: IF NULL skips the rejection.
create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(private.naxa_business_function(auth.uid())='admin', false)
$function$;

comment on function private.is_admin() is
'Returns a non-null boolean. Inactive or non-Admin identities are always false; central guard for Admin authorization.';
