-- NAXA Client privacy across Pharmacy / SPD employer workspaces.
-- REPLAY ONLY. Synthetic personal records and partner fixtures are rolled back.

begin;

do $setup$
declare
  v_employee uuid:='5f03b180-2605-4de4-8161-f719ce24ae82'; -- pharmacy stock staff
  v_client uuid:='dcb2242b-50fb-46c8-8c90-e01d42fa4175'; -- ordinary client / SPD operator
  v_promoter uuid:='b5b79627-46ac-4dea-8ea9-6f0464cb3404';
  v_pharmacist uuid:='1441cd43-b643-41ed-85eb-6e519adb8f44';
  v_admin uuid:='5bff6417-ebd2-4c2f-b675-424632fa43a4';
  v_pharmacy uuid:='76dd4983-273a-4a83-ae3d-9a7838d3aa35';
  v_partner uuid;
  v_request uuid;
  v_approval record;
  v_employee_doc text;
  v_client_doc text;
  v_prescription uuid;
begin
  if not private.naxa_client_identity_is_staff_of_pharmacy(v_employee,v_pharmacy) then
    raise exception 'Employee fixture is not assigned to the test pharmacy';
  end if;
  if private.naxa_client_identity_is_staff_of_pharmacy(v_client,v_pharmacy) then
    raise exception 'Ordinary client fixture unexpectedly belongs to test pharmacy staff';
  end if;

  -- Admin arbitration is required because the SPD owner is also a Promoteur.
  perform set_config('request.jwt.claim.sub',v_promoter::text,true);
  v_request:=public.naxa_request_cumulative_activity(
    v_promoter,'PHARMACIE_VERS_SPD',null,null,null,'Privacy test SPD owner self-arbitration'
  );
  if v_request is null then raise exception 'SPD owner arbitration request missing'; end if;
  for v_approval in
    select id,is_admin_required from public.naxa_cumulative_activity_approvals
    where request_id=v_request and status='pending'
  loop
    if not v_approval.is_admin_required then raise exception 'Promoteur self-approval was not blocked'; end if;
    perform set_config('request.jwt.claim.sub',v_admin::text,true);
    perform public.naxa_decide_cumulative_activity(v_approval.id,'approve',null);
  end loop;
  if (select status from public.naxa_cumulative_activity_requests where id=v_request)<>'approved' then
    raise exception 'Admin did not approve all owner pharmacy scopes';
  end if;

  insert into public.partners(name,partner_type,city,status,created_by)
  values('NAXA E2E privacy SPD employer','professionnel_domicile','Yaoundé','active',v_promoter)
  returning id into v_partner;
  insert into public.partner_universes(partner_id,universe_slug,enabled)
  values(v_partner,'prestations',true);
  insert into public.partner_members(partner_id,user_id,member_role)
  values(v_partner,v_promoter,'owner'),(v_partner,v_client,'operator');
  insert into public.admin_partner_dossiers(
    partner_id,promoteur_id,universe_slug,monthly_fee_fcfa,documents_received,dossier_status,created_by
  ) values(v_partner,v_promoter,'prestations',1,'{"kyc":true}'::jsonb,'validated',v_promoter);
  update public.naxa_cumulative_activity_requests
  set status='completed',updated_at=now()
  where id=v_request and status='approved';
  if not private.naxa_partner_has_confirmed_payment(v_partner) then
    raise exception 'Paid SPD fixture is not eligible';
  end if;

  -- Two personal pharmacy records: one belongs to staff, one to an ordinary Client.
  insert into public.reservations(client_id,pharmacie_id,total)
  values(v_employee,v_pharmacy,2500),(v_client,v_pharmacy,3500);

  v_employee_doc:=v_employee::text||'/'||v_pharmacy::text||'/privacy-employee.pdf';
  v_client_doc:=v_client::text||'/'||v_pharmacy::text||'/privacy-client.pdf';
  insert into public.prescriptions(pharmacie_id,client_id,source,document_ref,statut)
  values(v_pharmacy,v_employee,'client',v_employee_doc,'en_attente')
  returning id into v_prescription;
  insert into public.prescription_items(prescription_id,designation_prescrite,quantite_prescrite)
  values(v_prescription,'Produit E2E privé employé',1);

  insert into public.prescriptions(pharmacie_id,client_id,source,document_ref,statut)
  values(v_pharmacy,v_client,'client',v_client_doc,'en_attente')
  returning id into v_prescription;
  insert into public.prescription_items(prescription_id,designation_prescrite,quantite_prescrite)
  values(v_prescription,'Produit E2E client',1);

  insert into storage.objects(bucket_id,name,owner,owner_id,metadata)
  values
    ('naxa-client-prescriptions',v_employee_doc,v_employee,v_employee::text,'{"mimetype":"application/pdf"}'::jsonb),
    ('naxa-client-prescriptions',v_client_doc,v_client,v_client::text,'{"mimetype":"application/pdf"}'::jsonb);

  insert into public.universe_reservations(client_id,partner_id,universe_slug,status,total_fcfa)
  values(v_client,v_partner,'prestations','requested',0);
end
$setup$;

set local role authenticated;

do $test$
declare
  v_employee uuid:='5f03b180-2605-4de4-8161-f719ce24ae82';
  v_client uuid:='dcb2242b-50fb-46c8-8c90-e01d42fa4175';
  v_promoter uuid:='b5b79627-46ac-4dea-8ea9-6f0464cb3404';
  v_pharmacist uuid:='1441cd43-b643-41ed-85eb-6e519adb8f44';
  v_pharmacy uuid:='76dd4983-273a-4a83-ae3d-9a7838d3aa35';
  v_partner uuid;
  v_employee_doc text;
  v_client_doc text;
  v_count integer;
begin
  select id into v_partner from public.partners
  where name='NAXA E2E privacy SPD employer' and created_by=v_promoter
  order by created_at desc limit 1;
  if v_partner is null then raise exception 'Privacy SPD fixture missing'; end if;
  v_employee_doc:=v_employee::text||'/'||v_pharmacy::text||'/privacy-employee.pdf';
  v_client_doc:=v_client::text||'/'||v_pharmacy::text||'/privacy-client.pdf';

  -- Employer/Promoteur can see ordinary Client records, never a staff member's personal records.
  perform set_config('request.jwt.claim.sub',v_promoter::text,true);
  if not public.naxa_select_active_role('promoteur',null,null) then raise exception 'Promoteur context unavailable'; end if;
  select count(*) into v_count from public.reservations where client_id=v_employee and pharmacie_id=v_pharmacy;
  if v_count<>0 then raise exception 'Pharmacy employer can read employee personal reservation'; end if;
  select count(*) into v_count from public.reservations where client_id=v_client and pharmacie_id=v_pharmacy;
  if v_count<>1 then raise exception 'Pharmacy staff cannot read ordinary client reservation'; end if;
  select count(*) into v_count from public.prescriptions where client_id=v_employee and pharmacie_id=v_pharmacy;
  if v_count<>0 then raise exception 'Pharmacy employer can read employee personal prescription'; end if;
  select count(*) into v_count from public.prescriptions where client_id=v_client and pharmacie_id=v_pharmacy;
  if v_count<>1 then raise exception 'Pharmacy staff cannot read ordinary client prescription'; end if;

  -- A pharmacist in the same pharmacy cannot read the employee's own prescription or file.
  perform set_config('request.jwt.claim.sub',v_pharmacist::text,true);
  if not public.naxa_select_active_role('pharmacien',v_pharmacy,null) then raise exception 'Pharmacist context unavailable'; end if;
  select count(*) into v_count from public.prescriptions where client_id=v_employee and pharmacie_id=v_pharmacy;
  if v_count<>0 then raise exception 'Pharmacist can read staff member personal prescription'; end if;
  select count(*) into v_count from public.prescriptions where client_id=v_client and pharmacie_id=v_pharmacy;
  if v_count<>1 then raise exception 'Pharmacist cannot read ordinary client prescription'; end if;
  select count(*) into v_count from storage.objects where bucket_id='naxa-client-prescriptions' and name=v_employee_doc;
  if v_count<>0 then raise exception 'Pharmacist can read staff member personal prescription file'; end if;
  select count(*) into v_count from storage.objects where bucket_id='naxa-client-prescriptions' and name=v_client_doc;
  if v_count<>1 then raise exception 'Pharmacist cannot read ordinary client prescription file'; end if;

  -- The staff member retains Client access, but personal records disappear in Pharmacy context.
  perform set_config('request.jwt.claim.sub',v_employee::text,true);
  if not public.naxa_select_active_role('client',null,null) then raise exception 'Employee Client context unavailable'; end if;
  select count(*) into v_count from public.reservations where client_id=v_employee and pharmacie_id=v_pharmacy;
  if v_count<>1 then raise exception 'Employee cannot read own reservation in Client context'; end if;
  select count(*) into v_count from public.prescriptions where client_id=v_employee and pharmacie_id=v_pharmacy;
  if v_count<>1 then raise exception 'Employee cannot read own prescription in Client context'; end if;
  select count(*) into v_count from storage.objects where bucket_id='naxa-client-prescriptions' and name=v_employee_doc;
  if v_count<>1 then raise exception 'Employee cannot read own prescription file in Client context'; end if;

  if not public.naxa_select_active_role('gestionnaire_stock',v_pharmacy,null) then
    raise exception 'Employee Pharmacy context unavailable';
  end if;
  select count(*) into v_count from public.reservations where client_id=v_employee and pharmacie_id=v_pharmacy;
  if v_count<>0 then raise exception 'Employee personal reservation leaked into Pharmacy context'; end if;
  select count(*) into v_count from public.prescriptions where client_id=v_employee and pharmacie_id=v_pharmacy;
  if v_count<>0 then raise exception 'Employee personal prescription leaked into Pharmacy context'; end if;
  select count(*) into v_count from storage.objects where bucket_id='naxa-client-prescriptions' and name=v_employee_doc;
  if v_count<>0 then raise exception 'Employee personal prescription file leaked into Pharmacy context'; end if;

  -- SPD employer cannot read an operator's personal Client reservation.
  perform set_config('request.jwt.claim.sub',v_promoter::text,true);
  if not public.naxa_select_active_role('prestations',null,v_partner) then raise exception 'SPD owner context unavailable'; end if;
  select count(*) into v_count from public.universe_reservations
  where partner_id=v_partner and client_id=v_client;
  if v_count<>0 then raise exception 'SPD employer can read operator personal Client reservation'; end if;

  perform set_config('request.jwt.claim.sub',v_client::text,true);
  if not public.naxa_select_active_role('client',null,null) then raise exception 'SPD operator Client context unavailable'; end if;
  select count(*) into v_count from public.universe_reservations
  where partner_id=v_partner and client_id=v_client;
  if v_count<>1 then raise exception 'SPD operator cannot read own Client reservation'; end if;
  if not public.naxa_select_active_role('prestations',null,v_partner) then raise exception 'SPD operator workspace unavailable'; end if;
  select count(*) into v_count from public.universe_reservations
  where partner_id=v_partner and client_id=v_client;
  if v_count<>0 then raise exception 'Operator personal Client reservation leaked into SPD workspace'; end if;

  raise notice 'PASS: pharmacy employer and pharmacist cannot read staff personal reservations, prescriptions or files; ordinary client records remain available; employee retains Client data only in Client context; SPD employer cannot read operator personal Client reservation';
end
$test$;

rollback;
