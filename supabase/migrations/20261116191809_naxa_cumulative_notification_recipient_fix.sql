do $patch$
declare v_definition text;
begin
 select pg_get_functiondef('public.naxa_request_cumulative_activity(uuid,text,uuid,uuid,text,text)'::regprocedure)
 into v_definition;
 v_definition:=replace(v_definition,
   'insert into public.notifications(user_id,pharmacie_id,type,titre,corps,related_entity_id)',
   'insert into public.notifications(user_id,type,titre,corps,related_entity_id)');
 v_definition:=replace(v_definition,
   'select p.id,r.organization_id,''cumulative_activity_request'',',
   'select p.id,''cumulative_activity_request'',');
 v_definition:=replace(v_definition,
   'values(r.approver_id,r.organization_id,''cumulative_activity_request'',',
   'values(r.approver_id,''cumulative_activity_request'',');
 if position('notifications(user_id,pharmacie_id,type,titre,corps,related_entity_id)' in v_definition)>0 then
   execute v_definition;
 end if;
end
$patch$;
