do $patch$
declare v_definition text; v_old text; v_new text;
begin
 select pg_get_functiondef('public.naxa_request_cumulative_activity(uuid,text,uuid,uuid,text,text)'::regprocedure)
 into v_definition;
 v_old := ' v_admin_required boolean;';
 v_new := ' v_admin_required boolean; v_set_matches boolean:=false;';
 if position(v_new in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Cumulative request declarations changed'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
 end if;

 v_old := ' if not v_has_source then return null; end if;';
 v_new := $no_source$
 if not v_has_source then
   update public.naxa_cumulative_activity_approvals a
   set status='invalidated',decided_at=coalesce(a.decided_at,now()),
       decision_reason=coalesce(a.decision_reason,'Aucune affectation source active restante')
   from public.naxa_cumulative_activity_requests req
   where a.request_id=req.id and req.target_profile_id=p_target_profile_id
     and req.direction=p_direction
     and req.destination_pharmacy_id is not distinct from p_destination_pharmacy_id
     and req.destination_role_code is not distinct from p_destination_role_code
     and req.status in ('pending','approved') and a.status in ('pending','approved');
   update public.naxa_cumulative_activity_requests
   set status='cancelled',updated_at=now()
   where target_profile_id=p_target_profile_id and direction=p_direction
     and destination_pharmacy_id is not distinct from p_destination_pharmacy_id
     and destination_partner_id is not distinct from p_destination_partner_id
     and destination_role_code is not distinct from p_destination_role_code
     and status in ('pending','approved');
   return null;
 end if;
$no_source$;
 if position('Aucune affectation source active restante' in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'No-source return anchor changed'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
 end if;
 execute v_definition;
end
$patch$;
