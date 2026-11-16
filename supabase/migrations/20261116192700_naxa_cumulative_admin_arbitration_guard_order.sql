do $verify$
declare v_definition text; v_request_pos integer; v_guard_pos integer;
begin
 select pg_get_functiondef('public.naxa_decide_cumulative_activity(uuid,text,text)'::regprocedure)
 into v_definition;
 v_request_pos:=position('select * into v_request from public.naxa_cumulative_activity_requests' in v_definition);
 v_guard_pos:=position('if v_admin and not v_approval.is_admin_required' in v_definition);
 if v_request_pos=0 or v_guard_pos=0 or v_guard_pos<v_request_pos then
   raise exception 'Admin arbitration guard must run after approval and request rows are locked';
 end if;
end
$verify$;
