-- Admin identity can use its own Client space without retaining Admin authority.
-- REPLAY ONLY. Phone is populated only inside this transaction to satisfy Client identity prerequisites.

begin;
update public.profiles set phone='237699999001'
where id='5bff6417-ebd2-4c2f-b675-424632fa43a4';
set local role authenticated;
select set_config('request.jwt.claim.sub','5bff6417-ebd2-4c2f-b675-424632fa43a4',true);

do $test$
declare v_denied boolean:=false;
begin
  if not public.naxa_select_active_role('client',null,null) then
    raise exception 'Admin identity cannot select its own Client space';
  end if;
  if public.naxa_business_function()<>'client' or public.is_admin() then
    raise exception 'Admin privileges were not suspended in Client context';
  end if;

  if public.is_admin() then raise exception 'Admin capability remains active in Client context'; end if;

  if not public.naxa_select_active_role('admin',null,null) then
    raise exception 'Admin context could not be selected again';
  end if;
  if not public.is_admin() then
    raise exception 'Admin authority was not restored after switching back';
  end if;
  raise notice 'PASS: Client identity and Admin workspace coexist; active context controls Admin capability';
end
$test$;

rollback;
