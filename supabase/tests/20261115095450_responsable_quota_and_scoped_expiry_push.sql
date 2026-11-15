do $test$
declare
  v_assignment text;
  v_claim text;
  v_dispatch text;
  v_assignment_normal text;
begin
  v_assignment:=pg_get_functiondef(
    'public.naxa_grant_professional_assignment(uuid,uuid,text,timestamp with time zone,timestamp with time zone,text)'::regprocedure
  );
  v_assignment_normal:=regexp_replace(lower(v_assignment),'\s+',' ','g');

  if position('v_max_responsables' in v_assignment_normal)=0
     or position('naxa-responsable-quota:' in v_assignment_normal)=0
     or position('a.role_code=''responsable''' in v_assignment_normal)=0
     or position('a.commence_at<=now()' in v_assignment_normal)=0
     or position('a.expire_at is null or a.expire_at>now()' in v_assignment_normal)=0
     or position('quota responsables atteint' in v_assignment_normal)=0 then
    raise exception 'Le RPC Promoteur doit appliquer le plafond Responsable et sérialiser les attributions par pharmacie';
  end if;

  if has_function_privilege(
       'anon',
       'public.naxa_grant_professional_assignment(uuid,uuid,text,timestamp with time zone,timestamp with time zone,text)'::regprocedure,
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.naxa_grant_professional_assignment(uuid,uuid,text,timestamp with time zone,timestamp with time zone,text)'::regprocedure,
       'EXECUTE'
     ) then
    raise exception 'Les ACL du RPC d’affectation doivent rester authenticated/service_role sans anon';
  end if;

  v_claim:=pg_get_functiondef(
    'public.claim_notification_push_outbox_for_notification(uuid)'::regprocedure
  );
  if position('o.notification_id=p_notification_id' in lower(v_claim))=0
     or position('for update skip locked' in lower(v_claim))=0
     or has_function_privilege(
       'authenticated',
       'public.claim_notification_push_outbox_for_notification(uuid)'::regprocedure,
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.claim_notification_push_outbox_for_notification(uuid)'::regprocedure,
       'EXECUTE'
     ) then
    raise exception 'Le claim push ciblé doit isoler une notification et rester réservé à service_role';
  end if;

  v_dispatch:=pg_get_functiondef(
    'public.naxa_dispatch_pharmacy_lot_expiry_alerts_internal(date,integer)'::regprocedure
  );
  if position('request.jwt.claim.role' in lower(v_dispatch))=0
     or position('private.dispatch_pharmacy_lot_expiry_alerts' in lower(v_dispatch))=0
     or has_function_privilege(
       'authenticated',
       'public.naxa_dispatch_pharmacy_lot_expiry_alerts_internal(date,integer)'::regprocedure,
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.naxa_dispatch_pharmacy_lot_expiry_alerts_internal(date,integer)'::regprocedure,
       'EXECUTE'
     ) then
    raise exception 'Le dispatcher interne doit être réservé au rôle service_role';
  end if;
end
$test$;

select 'Responsible quota, scoped push claim and service-role-only expiry dispatch: PASS' as result;
