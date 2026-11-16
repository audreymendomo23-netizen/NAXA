do $patch$
declare v_definition text; v_old text; v_new text;
begin
 select pg_get_functiondef('public.naxa_request_cumulative_activity(uuid,text,uuid,uuid,text,text)'::regprocedure)
 into v_definition;
 v_old := ' from public.naxa_cumulative_activity_requests r
 where r.target_profile_id=p_target_profile_id and r.direction=p_direction
   and r.destination_pharmacy_id is not distinct from p_destination_pharmacy_id
   and r.destination_partner_id is not distinct from p_destination_partner_id
   and r.destination_role_code is not distinct from p_destination_role_code
   and r.status in (''pending'',''approved'',''rejected'')
 order by r.created_at desc limit 1 for update;';
 v_new := ' from public.naxa_cumulative_activity_requests request_row
 where request_row.target_profile_id=p_target_profile_id and request_row.direction=p_direction
   and request_row.destination_pharmacy_id is not distinct from p_destination_pharmacy_id
   and request_row.destination_partner_id is not distinct from p_destination_partner_id
   and request_row.destination_role_code is not distinct from p_destination_role_code
   and request_row.status in (''pending'',''approved'',''rejected'')
 order by request_row.created_at desc limit 1 for update;';
 if position(v_new in v_definition)=0 and position(v_old in v_definition)>0 then
   v_definition:=replace(v_definition,v_old,v_new);
   execute v_definition;
 end if;
end
$patch$;
