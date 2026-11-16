-- NAXA cumulative approvals across multiple pharmacies / promoters.
-- REPLAY ONLY: synthetic fixtures and all mutations are enclosed in BEGIN/ROLLBACK.
-- Never execute this test against Production.

begin;

do $test$
declare
  v_target uuid := '5f03b180-2605-4de4-8161-f719ce24ae82'; -- e2e_stock
  v_promoter_one uuid := 'b5b79627-46ac-4dea-8ea9-6f0464cb3404'; -- existing promoter
  v_promoter_two uuid := 'dcb2242b-50fb-46c8-8c90-e01d42fa4175'; -- e2e client, temporary promoter
  v_admin uuid := '5bff6417-ebd2-4c2f-b675-424632fa43a4';
  v_pharmacy_one uuid := '76dd4983-273a-4a83-ae3d-9a7838d3aa35'; -- Mvan
  v_pharmacy_two uuid := '86bfc15b-0737-4656-ab72-0a199acb8b1f'; -- Essos
  v_convention uuid;
  v_assignment uuid;
  v_request uuid;
  v_request_after_revoke uuid;
  v_approval_one uuid;
  v_approval_two uuid;
  v_status text;
begin
  if not exists(select 1 from public.profiles where id=v_target and actif=true)
     or not exists(select 1 from public.profiles where id=v_promoter_one and actif=true and role::text='promoteur')
     or not exists(select 1 from public.profiles where id=v_promoter_two and actif=true and role::text='client')
     or not exists(select 1 from public.profiles where id=v_admin and actif=true and role::text='admin')
     or not exists(select 1 from public.naxa_professional_assignments
       where profile_id=v_target and pharmacie_id=v_pharmacy_one and statut='active')
     or not exists(select 1 from public.pharmacie_architectures
       where pharmacie_id=v_pharmacy_two and architecture_code='HYBRIDE' and active=true) then
    raise exception 'Required Replay fixtures are missing';
  end if;

  -- Give a second synthetic promoter a valid, isolated Essos scope for this transaction.
  update public.profiles set role='promoteur' where id=v_promoter_two;
  insert into public.conventions_promoteurs(
    promoteur_id,montant_mensuel,date_paiement,date_expiration,statut,architecture_code
  ) values(v_promoter_two,5000,current_date,current_date+30,'active','HYBRIDE')
  returning id into v_convention;
  insert into public.abonnements_promoteurs(
    promoteur_id,convention_id,montant_mensuel,debut,echeance,statut
  ) values(v_promoter_two,v_convention,5000,current_date,current_date+30,'actif');

  update public.promoteur_pharmacies
  set actif=false
  where promoteur_id=v_promoter_one and pharmacie_id=v_pharmacy_two;
  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values(v_promoter_two,v_pharmacy_two,true);

  insert into public.naxa_professional_assignments(
    profile_id,pharmacie_id,fonction,statut,motif,commence_at,accorde_par,nature_affectation,role_code
  ) values(
    v_target,v_pharmacy_two,'gestionnaire_stock','active',
    'Affectation synthétique multi-promoteur E2E',now()-interval '1 minute',
    v_promoter_two,'ordinaire','gestionnaire_stock'
  ) returning id into v_assignment;

  if not private.naxa_promoteur_valide(v_promoter_two) then
    raise exception 'Second promoter fixture is not valid';
  end if;

  -- Two pharmacies owned by two distinct promoters => two independent approvals.
  perform set_config('request.jwt.claim.sub',v_target::text,true);
  v_request:=public.naxa_request_cumulative_activity(
    v_target,'PHARMACIE_VERS_SPD',null,null,null,'E2E two pharmacies / two promoters'
  );
  if v_request is null then raise exception 'Multi-promoter request was not created'; end if;
  if (select status from public.naxa_cumulative_activity_requests where id=v_request)<>'pending' then
    raise exception 'Request must remain pending until both promoters decide';
  end if;
  if (select count(*) from public.naxa_cumulative_activity_approvals
      where request_id=v_request and status='pending' and organization_type='pharmacie')<>2 then
    raise exception 'Expected two separate pharmacy approval rows';
  end if;
  if (select count(*) from public.notifications
      where related_entity_id=v_request and type='cumulative_activity_request'
        and user_id in (v_promoter_one,v_promoter_two))<>2 then
    raise exception 'Both promoters did not receive durable in-app notifications';
  end if;

  select id into v_approval_one from public.naxa_cumulative_activity_approvals
  where request_id=v_request and approver_id=v_promoter_one and organization_id=v_pharmacy_one;
  select id into v_approval_two from public.naxa_cumulative_activity_approvals
  where request_id=v_request and approver_id=v_promoter_two and organization_id=v_pharmacy_two;
  if v_approval_one is null or v_approval_two is null then
    raise exception 'Promoter-to-pharmacy approval mapping is incomplete';
  end if;

  perform set_config('request.jwt.claim.sub',v_promoter_one::text,true);
  v_status:=public.naxa_decide_cumulative_activity(v_approval_one,'approve',null);
  if v_status<>'pending' then raise exception 'First promoter approval must not activate SPD'; end if;

  perform set_config('request.jwt.claim.sub',v_promoter_two::text,true);
  v_status:=public.naxa_decide_cumulative_activity(v_approval_two,'approve',null);
  if v_status<>'approved' then raise exception 'Second promoter approval did not complete request'; end if;

  -- Revoke one source assignment: old request and approvals must be invalidated immediately.
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform public.naxa_revoke_professional_assignment(v_assignment,'E2E revoke second pharmacy before Admin dossier');
  if (select status from public.naxa_cumulative_activity_requests where id=v_request)<>'cancelled' then
    raise exception 'Source revocation did not cancel the previously approved request';
  end if;
  if exists(select 1 from public.naxa_cumulative_activity_approvals
    where request_id=v_request and status in ('pending','approved')) then
    raise exception 'Stale approvals survived source revocation';
  end if;

  begin
    perform public.naxa_decide_cumulative_activity(v_approval_two,'approve',null);
    raise exception 'Invalidated second-promoter approval remained actionable';
  exception when check_violation then null;
  end;

  -- Re-request recalculates the source set: only the remaining pharmacy promoter is needed.
  perform set_config('request.jwt.claim.sub',v_target::text,true);
  v_request_after_revoke:=public.naxa_request_cumulative_activity(
    v_target,'PHARMACIE_VERS_SPD',null,null,null,'E2E recalculated after one pharmacy revocation'
  );
  if v_request_after_revoke is null or v_request_after_revoke=v_request then
    raise exception 'A fresh request was not created after source-set change';
  end if;
  if (select count(*) from public.naxa_cumulative_activity_approvals
      where request_id=v_request_after_revoke and status='pending')<>1 then
    raise exception 'Recalculated request should contain exactly one remaining promoter';
  end if;
  if exists(select 1 from public.naxa_cumulative_activity_approvals
      where request_id=v_request_after_revoke and approver_id=v_promoter_two) then
    raise exception 'Revoked pharmacy promoter remains in the new approval set';
  end if;

  select id into v_approval_one from public.naxa_cumulative_activity_approvals
  where request_id=v_request_after_revoke and approver_id=v_promoter_one;
  perform set_config('request.jwt.claim.sub',v_promoter_one::text,true);
  v_status:=public.naxa_decide_cumulative_activity(v_approval_one,'approve',null);
  if v_status<>'approved' then raise exception 'Remaining promoter could not complete recalculated request'; end if;

  -- Any single refusal remains final and blocks the cumulative path.
  perform set_config('request.jwt.claim.sub','1441cd43-b643-41ed-85eb-6e519adb8f44',true);
  v_request:=public.naxa_request_cumulative_activity(
    '1441cd43-b643-41ed-85eb-6e519adb8f44','PHARMACIE_VERS_SPD',null,null,null,'E2E promoter refusal'
  );
  select id into v_approval_one from public.naxa_cumulative_activity_approvals
  where request_id=v_request and status='pending' limit 1;
  perform set_config('request.jwt.claim.sub',v_promoter_one::text,true);
  v_status:=public.naxa_decide_cumulative_activity(v_approval_one,'reject','Refus E2E explicite');
  if v_status<>'rejected' then raise exception 'A single promoter refusal did not reject the request'; end if;

  raise notice 'PASS: two distinct promoters; no implicit approval; durable notifications; one consent insufficient; source revocation invalidates old approval; re-request recalculates remaining promoter; one refusal rejects';
end
$test$;

rollback;
