-- NAXA cumulative-workspace RLS / RPC authorization E2E.
-- REPLAY ONLY. Run with database owner connection; transaction is rolled back.

begin;
set local role authenticated;

select set_config('request.jwt.claim.sub','5f03b180-2605-4de4-8161-f719ce24ae82',true);

do $test$
declare
  v_target uuid:='5f03b180-2605-4de4-8161-f719ce24ae82';
  v_promoter uuid:='b5b79627-46ac-4dea-8ea9-6f0464cb3404';
  v_unrelated uuid:='dcb2242b-50fb-46c8-8c90-e01d42fa4175';
  v_request uuid;
  v_approval uuid;
  v_count integer;
  v_rows integer;
  v_denied boolean;
begin
  if not exists(
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='naxa_cumulative_activity_requests' and c.relrowsecurity
  ) or not exists(
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='naxa_cumulative_activity_approvals' and c.relrowsecurity
  ) then raise exception 'Cumulative tables must have RLS enabled'; end if;

  if has_function_privilege('anon','public.naxa_request_cumulative_activity(uuid,text,uuid,uuid,text,text)','EXECUTE')
     or has_function_privilege('anon','public.naxa_decide_cumulative_activity(uuid,text,text)','EXECUTE') then
    raise exception 'Anonymous role can execute cumulative RPC';
  end if;
  if has_function_privilege('authenticated','public.naxa_request_cumulative_activity(uuid,text,uuid,uuid,text,text)','EXECUTE') is false
     or has_function_privilege('authenticated','public.naxa_decide_cumulative_activity(uuid,text,text)','EXECUTE') is false then
    raise exception 'Authenticated RPC grants missing';
  end if;

  v_request:=public.naxa_request_cumulative_activity(
    v_target,'PHARMACIE_VERS_SPD',null,null,null,'E2E RLS isolation and RPC guard'
  );
  if (select count(*) from public.naxa_cumulative_activity_requests where id=v_request)<>1 then
    raise exception 'Target cannot read its own cumulative request';
  end if;
  select id into v_approval from public.naxa_cumulative_activity_approvals
  where request_id=v_request and approver_id=v_promoter and status='pending' limit 1;
  if v_approval is null then raise exception 'Promoter approval missing'; end if;

  -- An unrelated Client must not read the request or its approval.
  perform set_config('request.jwt.claim.sub',v_unrelated::text,true);
  select count(*) into v_count from public.naxa_cumulative_activity_requests where id=v_request;
  if v_count<>0 then raise exception 'Unrelated Client can read another user request'; end if;
  select count(*) into v_count from public.naxa_cumulative_activity_approvals where id=v_approval;
  if v_count<>0 then raise exception 'Unrelated Client can read another organization approval'; end if;

  v_denied:=false;
  begin
    perform public.naxa_decide_cumulative_activity(v_approval,'approve',null);
  exception when insufficient_privilege then v_denied:=true;
  end;
  if not v_denied then raise exception 'Unrelated Client was able to approve a cumulative request'; end if;

  -- The named Promoteur cannot decide while the Client workspace is active.
  perform set_config('request.jwt.claim.sub',v_promoter::text,true);
  perform public.naxa_select_active_role('client',null,null);
  v_denied:=false;
  begin
    perform public.naxa_decide_cumulative_activity(v_approval,'approve',null);
  exception when insufficient_privilege then v_denied:=true;
  end;
  if not v_denied then raise exception 'Promoteur approved while Client workspace was active'; end if;

  -- Only the named Promoteur sees the durable notification and can decide.
  perform public.naxa_select_active_role('promoteur',null,null);
  select count(*) into v_count from public.notifications
  where user_id=auth.uid() and type='cumulative_activity_request' and related_entity_id=v_request;
  if v_count<>1 then raise exception 'Promoter notification is missing or visible to wrong recipient'; end if;

  -- Direct table writes cannot bypass the decision RPC.
  v_denied:=false;
  begin
    update public.naxa_cumulative_activity_approvals set status='approved' where id=v_approval;
    get diagnostics v_rows=row_count;
    if v_rows<>0 then raise exception 'Direct approval table update bypassed RPC'; end if;
  exception when insufficient_privilege then v_denied:=true;
  end;
  v_denied:=false;
  begin
    update public.naxa_cumulative_activity_requests set status='approved' where id=v_request;
    get diagnostics v_rows=row_count;
    if v_rows<>0 then raise exception 'Direct request table update bypassed RPC'; end if;
  exception when insufficient_privilege then v_denied:=true;
  end;

  perform set_config('request.jwt.claim.sub',v_target::text,true);
  select count(*) into v_count from public.naxa_cumulative_activity_requests where id=v_request;
  if v_count<>1 then raise exception 'Target lost access to own request'; end if;

  raise notice 'PASS: RLS enabled; anon RPC denied; target/approver scoped reads; unrelated Client denied; notifications recipient-scoped; direct writes cannot bypass decision RPC';
end
$test$;

rollback;
