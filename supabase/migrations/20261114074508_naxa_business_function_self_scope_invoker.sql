-- NAXA — empêcher la consultation publique du rôle d'un profil arbitraire.
begin;
do $copy_base$
declare v_definition text;
begin
  select pg_get_functiondef('private.naxa_business_function(uuid)'::regprocedure)
    into v_definition;
  v_definition:=replace(v_definition,'FUNCTION private.naxa_business_function(','FUNCTION private.naxa_business_function_base(');
  if position('FUNCTION private.naxa_business_function_base(' in v_definition)=0 then
    raise exception 'Unable to snapshot private role resolver';
  end if;
  execute v_definition;
end;
$copy_base$;
create or replace function private.naxa_business_function(p_profile uuid default auth.uid())
returns text language sql stable security definer set search_path to ''
as $function$
  select coalesce(private.naxa_partner_business_function(p_profile),private.naxa_business_function_base(p_profile));
$function$;
create or replace function public.naxa_business_function(p_profile uuid default auth.uid())
returns text language sql stable security invoker set search_path to ''
as $function$
  select case when p_profile is not null and p_profile=(select auth.uid())
    then private.naxa_business_function(p_profile) else null end;
$function$;
do $rewrite_internal_business_calls$
declare r record; v_definition text; v_count integer:=0;
begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','private') and p.prokind='f'
      and p.oid<>'public.naxa_business_function(uuid)'::regprocedure
      and lower(p.prosrc) like '%public.naxa_business_function(%'
  loop
    v_definition:=replace(pg_get_functiondef(r.oid),'public.naxa_business_function(','private.naxa_business_function(');
    execute v_definition; v_count:=v_count+1;
  end loop;
  raise notice 'Internal business-role references redirected: %',v_count;
end;
$rewrite_internal_business_calls$;
revoke all on function private.naxa_business_function_base(uuid) from public,anon,authenticated;
revoke execute on function private.naxa_partner_business_function(uuid) from anon;
commit;
