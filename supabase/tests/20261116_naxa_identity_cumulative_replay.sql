-- NAXA identity / cumulative-workspace E2E — REPLAY ONLY.
-- Run only against the isolated Replay project with a database owner connection.
-- Every fixture and mutation is inside one transaction and is rolled back.
-- Never run against Production.

begin;

do $test$
declare
  v_target uuid := '875507d2-cdb8-4166-9c19-b243934f2177';
  v_spd_operator uuid := 'dcb2242b-50fb-46c8-8c90-e01d42fa4175';
  v_promoter uuid := 'b5b79627-46ac-4dea-8ea9-6f0464cb3404';
  v_admin uuid := '5bff6417-ebd2-4c2f-b675-424632fa43a4';
  v_pharmacy uuid := '1a4f1ce5-cccf-477e-9a5b-474c8c9fc713';
  v_request uuid;
  v_promoter_request uuid;
  v_approval record;
  v_partner uuid;
  v_assignment uuid;
  v_status text;
  v_denied boolean;
  v_client_ok boolean;
  v_profile_active boolean;
begin
  -- Fixture preconditions: current Replay demo users, active pharmacy, promoter access.
  if not exists(select 1 from public.profiles where id=v_target and actif=true and age_verified=true)
     or not exists(select 1 from public.profiles where id=v_spd_operator and actif=true and age_verified=true)
     or not exists(select 1 from public.profiles where id=v_promoter and actif=true and role::text='promoteur')
     or not exists(select 1 from public.profiles where id=v_admin and actif=true and role::text='admin')
     or not exists(select 1 from public.pharmacies where id=v_pharmacy and actif=true) then
    raise exception 'Replay fixtures are missing or inactive';
  end if;

  -- 1. Pharmacy -> SPD: all current pharmacy Promoteurs must approve.
  perform set_config('request.jwt.claim.sub',v_target::text,true);
  v_request:=public.naxa_request_cumulative_activity(
    v_target,'PHARMACIE_VERS_SPD',null,null,null,'E2E Replay pharmacy to SPD'
  );
  if v_request is null then raise exception 'Expected a pending pharmacy-to-SPD request'; end if;
  if not exists(select 1 from public.naxa_cumulative_activity_approvals
    where request_id=v_request and status='pending') then
    raise exception 'No pharmacy approvals were created';
  end if;

  for v_approval in
    select id,approver_id,is_admin_required
    from public.naxa_cumulative_activity_approvals
    where request_id=v_request and status='pending'
  loop
    perform set_config('request.jwt.claim.sub',
      case when v_approval.is_admin_required then v_admin::text else v_approval.approver_id::text end,true);
    perform public.naxa_decide_cumulative_activity(v_approval.id,'approve',null);
  end loop;
  select status into v_status from public.naxa_cumulative_activity_requests where id=v_request;
  if v_status<>'approved' then raise exception 'Pharmacy-to-SPD approvals did not complete'; end if;

  perform set_config('request.jwt.claim.sub',v_target::text,true);
  if public.naxa_request_cumulative_activity(
    v_target,'PHARMACIE_VERS_SPD',null,null,null,'E2E Replay pharmacy to SPD'
  ) is not null then
    raise exception 'Approved request was not idempotently reused';
  end if;

  -- A Promoteur cannot authorize their own cumulative SPD registration.
  -- Each of their pharmacies is sent to Admin arbitration.
  perform set_config('request.jwt.claim.sub',v_promoter::text,true);
  v_promoter_request:=public.naxa_request_cumulative_activity(
    v_promoter,'PHARMACIE_VERS_SPD',null,null,null,'E2E Replay promoter self-arbitration'
  );
  if v_promoter_request is null then raise exception 'Promoter self-arbitration request missing'; end if;
  if (select count(*) from public.naxa_cumulative_activity_approvals
      where request_id=v_promoter_request and is_admin_required=true and status='pending')<1 then
    raise exception 'Promoter self-approval was not routed to Admin';
  end if;
  for v_approval in
    select id,is_admin_required from public.naxa_cumulative_activity_approvals
    where request_id=v_promoter_request and status='pending'
  loop
    if not v_approval.is_admin_required then raise exception 'Promoter was allowed to approve their own request'; end if;
    perform set_config('request.jwt.claim.sub',v_admin::text,true);
    perform public.naxa_decide_cumulative_activity(v_approval.id,'approve',null);
  end loop;
  select status into v_status from public.naxa_cumulative_activity_requests where id=v_promoter_request;
  if v_status<>'approved' then raise exception 'Admin arbitration for Promoteur did not complete'; end if;

  -- 2. SPD -> Pharmacy: a paid SPD owner must approve before a grant.
  insert into public.partners(name,partner_type,city,status,created_by)
  values('NAXA E2E paid SPD employer','professionnel_domicile','Yaoundé','active',v_promoter)
  returning id into v_partner;
  insert into public.partner_universes(partner_id,universe_slug,enabled)
  values(v_partner,'prestations',true);
  insert into public.partner_members(partner_id,user_id,member_role)
  values(v_partner,v_promoter,'owner'),(v_partner,v_spd_operator,'operator');
  insert into public.admin_partner_dossiers(
    partner_id,promoteur_id,universe_slug,monthly_fee_fcfa,documents_received,dossier_status,created_by
  ) values(v_partner,v_promoter,'prestations',1,'{"kyc":true}'::jsonb,'validated',v_promoter);
  update public.naxa_cumulative_activity_requests
  set status='completed',updated_at=now()
  where id=v_promoter_request and status='approved';

  perform set_config('request.jwt.claim.sub',v_promoter::text,true);
  v_denied:=false;
  begin
    perform public.naxa_grant_professional_assignment(
      v_spd_operator,v_pharmacy,'gestionnaire_stock',now(),now()+interval '30 days','E2E bypass attempt'
    );
  exception when others then
    v_denied:=position('Accord SPD requis' in sqlerrm)>0;
  end;
  if not v_denied then raise exception 'Direct pharmacy grant bypass was not blocked'; end if;

  v_request:=public.naxa_request_cumulative_activity(
    v_spd_operator,'SPD_VERS_PHARMACIE',v_pharmacy,null,'gestionnaire_stock','E2E Replay SPD to pharmacy'
  );
  select id into v_approval from public.naxa_cumulative_activity_approvals
  where request_id=v_request and status='pending' limit 1;
  if v_approval.id is null then raise exception 'SPD owner approval missing'; end if;
  perform public.naxa_decide_cumulative_activity(v_approval.id,'approve',null);
  v_assignment:=public.naxa_grant_professional_assignment(
    v_spd_operator,v_pharmacy,'gestionnaire_stock',now(),now()+interval '30 days','E2E approved SPD cumulative role'
  );
  if v_assignment is null then raise exception 'Approved pharmacy assignment was not created'; end if;
  select status into v_status from public.naxa_cumulative_activity_requests where id=v_request;
  if v_status<>'completed' then raise exception 'SPD-to-pharmacy request was not completed'; end if;

  -- 4. Accreditation revocation is not identity deletion/suspension.
  insert into public.profile_accreditations(grantor_profile_id,target_profile_id,pharmacie_id,niveau)
  values(v_promoter,v_target,v_pharmacy,2) returning id into v_approval;
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform public.retirer_accreditation(v_approval.id);
  if not exists(select 1 from public.profiles where id=v_target and actif=true)
     or exists(select 1 from public.profile_accreditations where id=v_approval.id and active=true) then
    raise exception 'Accreditation revocation affected the identity or failed to revoke the credential';
  end if;
end
$test$;


-- 5. Same Auth identity switches SPD -> Client -> SPD without re-authentication.
do $test$
declare
  v_target uuid := 'dcb2242b-50fb-46c8-8c90-e01d42fa4175';
  v_owner uuid := 'b5b79627-46ac-4dea-8ea9-6f0464cb3404';
  v_partner uuid;
  v_space text;
  v_active_partner uuid;
  v_denied boolean;
  v_profile_active boolean;
begin
  select id into v_partner from public.partners
  where name='NAXA E2E paid SPD employer' and created_by=v_owner and status='active'
  order by created_at desc limit 1;
  if v_partner is null then raise exception 'Paid SPD workspace fixture missing'; end if;

  perform set_config('request.jwt.claim.sub',v_target::text,true);
  perform public.naxa_select_active_role('prestations',null,v_partner);
  v_space:=public.naxa_business_function();
  v_active_partner:=public.naxa_active_role_partner();
  if v_space<>'prestations' or v_active_partner is distinct from v_partner then
    raise exception 'SPD workspace selection failed';
  end if;

  perform public.naxa_select_active_role('client',null,null);
  if public.naxa_business_function()<>'client' then
    raise exception 'Client workspace selection failed';
  end if;

  perform public.naxa_select_active_role('prestations',null,v_partner);
  if public.naxa_business_function()<>'prestations' then
    raise exception 'Returning to SPD without new Auth failed';
  end if;

  -- A subscription lock blocks only the professional workspace, not Client.
  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  insert into public.naxa_subscription_access_locks(promoteur_id,is_active,lock_reason)
  values(v_owner,true,'initial_payment_required')
  on conflict(promoteur_id) do update set is_active=true,lock_reason='initial_payment_required';
  if private.naxa_partner_has_confirmed_payment(v_partner) then
    raise exception 'SPD workspace remained paid after subscription lock';
  end if;
  v_denied:=false;
  begin perform public.naxa_select_active_role('prestations',null,v_partner);
  exception when others then v_denied:=true; end;
  if not v_denied then raise exception 'SPD workspace selection bypassed subscription lock'; end if;
  perform public.naxa_select_active_role('client',null,null);
  select actif into v_profile_active from public.profiles where id=v_owner;
  if public.naxa_business_function()<>'client' or not v_profile_active then
    raise exception 'Client space was disabled by professional subscription lock';
  end if;
end
$test$;

rollback;
