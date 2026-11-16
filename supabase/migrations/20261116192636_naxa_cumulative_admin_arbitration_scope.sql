do $patch$
declare v_definition text; v_old text; v_new text;
begin
 select pg_get_functiondef('public.naxa_decide_cumulative_activity(uuid,text,text)'::regprocedure)
 into v_definition;
 v_old := ' v_admin:=public.is_admin();';
 v_new := v_old;
 if position('L’Administrateur ne remplace pas les accords organisationnels ordinaires' in v_definition)=0 then
   v_old := $anchor$
 select * into v_request from public.naxa_cumulative_activity_requests
 where id=v_approval.request_id for update;
 if not found or v_request.status<>'pending' then
   raise exception 'Demande absente ou déjà clôturée' using errcode='23514';
 end if;
$anchor$;
   v_new := v_old || E'\n if v_admin and not v_approval.is_admin_required then\n   raise exception ''L’Administrateur ne remplace pas les accords organisationnels ordinaires'' using errcode=''42501'';\n end if;';
   if position(v_old in v_definition)=0 then raise exception 'Cumulative request lock anchor missing'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
   execute v_definition;
 end if;
end
$patch$;
