-- NAXA — le RPC public de poste ne révèle que le rôle de l'identité appelante.
begin;

do $setup$
declare
  v_self uuid;
  v_other uuid;
begin
  select id into v_self
  from public.profiles
  where actif is true and role::text='client'
  order by created_at,id
  limit 1;

  if v_self is null then
    raise exception 'No active Client profile available for self-scope test';
  end if;

  select id into v_other
  from public.profiles
  where actif is true and id<>v_self
  order by created_at,id
  limit 1;

  if v_other is null then
    raise exception 'Second active profile required for cross-profile test';
  end if;

  perform set_config('naxa.test.self_profile',v_self::text,true);
  perform set_config('naxa.test.other_profile',v_other::text,true);
end;
$setup$;

set local role authenticated;

do $test$
declare
  v_self uuid:=current_setting('naxa.test.self_profile')::uuid;
  v_other uuid:=current_setting('naxa.test.other_profile')::uuid;
  v_self_role text;
  v_other_role text;
  v_definition text;
begin
  perform set_config('request.jwt.claim.sub',v_self::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  perform set_config('request.jwt.claims',json_build_object('sub',v_self::text,'role','authenticated')::text,true);

  v_self_role:=public.naxa_business_function(v_self);
  v_other_role:=public.naxa_business_function(v_other);

  select pg_get_functiondef('public.naxa_business_function(uuid)'::regprocedure)
    into v_definition;

  if v_self_role is null then
    raise exception 'Authenticated caller cannot resolve its own active role';
  end if;
  if v_other_role is not null then
    raise exception 'Public business-role RPC disclosed a second profile role';
  end if;
  if v_definition ilike '%SECURITY DEFINER%'
     or v_definition not ilike '%auth.uid%'
     or v_definition not ilike '%private.naxa_business_function%' then
    raise exception 'Public business-role wrapper is not caller-scoped INVOKER code';
  end if;
  if not has_function_privilege('authenticated','public.naxa_business_function(uuid)','EXECUTE') then
    raise exception 'Authenticated role cannot execute its own role lookup';
  end if;
  if has_function_privilege('anon','public.naxa_business_function(uuid)','EXECUTE')
     or has_function_privilege('anon','private.naxa_business_function(uuid)','EXECUTE')
     or has_function_privilege('anon','private.naxa_partner_business_function(uuid)','EXECUTE') then
    raise exception 'Anonymous role has access to a business-role helper';
  end if;
end;
$test$;

rollback;

select 'NAXA_BUSINESS_FUNCTION_SELF_SCOPE PASS' as result;
