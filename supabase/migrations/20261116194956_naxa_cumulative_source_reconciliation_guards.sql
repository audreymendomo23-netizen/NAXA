
create or replace function private.naxa_cumulative_approval_set_current(p_request_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_request public.naxa_cumulative_activity_requests%rowtype;
  v_expected_count integer;
  v_actual_count integer;
begin
  select * into v_request
  from public.naxa_cumulative_activity_requests
  where id=p_request_id;
  if not found then return false; end if;

  if v_request.direction='PHARMACIE_VERS_SPD' then
    with expected as (
      select distinct pp.promoteur_id approver_id,pp.pharmacie_id organization_id
      from public.naxa_professional_assignments a
      join public.promoteur_pharmacies pp on pp.pharmacie_id=a.pharmacie_id and pp.actif=true
      join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
      where a.profile_id=v_request.target_profile_id and a.statut='active'
        and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now())
      union
      select distinct pp.promoteur_id,pp.pharmacie_id
      from public.promoteur_pharmacies pp
      join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
      where pp.promoteur_id=v_request.target_profile_id and pp.actif=true
      union
      select distinct pp.promoteur_id,pp.pharmacie_id
      from public.profiles p
      join public.promoteur_pharmacies pp on pp.pharmacie_id=p.pharmacie_id and pp.actif=true
      join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
      where p.id=v_request.target_profile_id and p.role::text in ('pharmacie','caisse')
    )
    select count(*) into v_expected_count from expected;

    if v_expected_count=0 then return false; end if;

    select count(*) into v_actual_count
    from public.naxa_cumulative_activity_approvals a
    where a.request_id=p_request_id and a.organization_type='pharmacie'
      and a.status in ('pending','approved');
    if v_expected_count<>v_actual_count then return false; end if;

    return not exists (
      with expected as (
        select distinct pp.promoteur_id approver_id,pp.pharmacie_id organization_id
        from public.naxa_professional_assignments a
        join public.promoteur_pharmacies pp on pp.pharmacie_id=a.pharmacie_id and pp.actif=true
        join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
        where a.profile_id=v_request.target_profile_id and a.statut='active'
          and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now())
        union
        select distinct pp.promoteur_id,pp.pharmacie_id
        from public.promoteur_pharmacies pp
        join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
        where pp.promoteur_id=v_request.target_profile_id and pp.actif=true
        union
        select distinct pp.promoteur_id,pp.pharmacie_id
        from public.profiles p
        join public.promoteur_pharmacies pp on pp.pharmacie_id=p.pharmacie_id and pp.actif=true
        join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
        where p.id=v_request.target_profile_id and p.role::text in ('pharmacie','caisse')
      ),
      actual as (
        select a.approver_id,a.organization_id,a.is_admin_required
        from public.naxa_cumulative_activity_approvals a
        where a.request_id=p_request_id and a.organization_type='pharmacie'
          and a.status in ('pending','approved')
      ),
      expected_normalized as (
        select e.approver_id,e.organization_id,(e.approver_id=v_request.target_profile_id) is_admin_required
        from expected e
      ),
      diff as (
        (select * from expected_normalized except select * from actual)
        union all
        (select * from actual except select * from expected_normalized)
      )
      select 1 from diff
    );

  elsif v_request.direction='SPD_VERS_PHARMACIE' then
    if not exists (
      select 1 from public.pharmacies ph
      where ph.id=v_request.destination_pharmacy_id and ph.actif=true and ph.archivee_le is null
    ) or not exists (
      select 1 from public.naxa_roles role_row
      where role_row.code=v_request.destination_role_code and role_row.actif=true
        and role_row.assignable=true and role_row.portee='PHARMACIE'
    ) then
      return false;
    end if;

    with expected as (
      select distinct owner.user_id approver_id,pa.id organization_id
      from public.partner_members member
      join public.partners pa on pa.id=member.partner_id
        and pa.partner_type='professionnel_domicile' and pa.status='active'
      join public.partner_universes pu on pu.partner_id=pa.id
        and pu.universe_slug='prestations' and pu.enabled=true
      join public.partner_members owner on owner.partner_id=pa.id and owner.member_role='owner'
      where member.user_id=v_request.target_profile_id
        and member.member_role in ('owner','manager','operator')
        and private.naxa_partner_has_confirmed_payment(pa.id)
    )
    select count(*) into v_expected_count from expected;

    if v_expected_count=0 then return false; end if;

    select count(*) into v_actual_count
    from public.naxa_cumulative_activity_approvals a
    where a.request_id=p_request_id and a.organization_type='spd'
      and a.status in ('pending','approved');
    if v_expected_count<>v_actual_count then return false; end if;

    return not exists (
      with expected as (
        select distinct owner.user_id approver_id,pa.id organization_id
        from public.partner_members member
        join public.partners pa on pa.id=member.partner_id
          and pa.partner_type='professionnel_domicile' and pa.status='active'
        join public.partner_universes pu on pu.partner_id=pa.id
          and pu.universe_slug='prestations' and pu.enabled=true
        join public.partner_members owner on owner.partner_id=pa.id and owner.member_role='owner'
        where member.user_id=v_request.target_profile_id
          and member.member_role in ('owner','manager','operator')
          and private.naxa_partner_has_confirmed_payment(pa.id)
      ),
      actual as (
        select a.approver_id,a.organization_id,a.is_admin_required
        from public.naxa_cumulative_activity_approvals a
        where a.request_id=p_request_id and a.organization_type='spd'
          and a.status in ('pending','approved')
      ),
      expected_normalized as (
        select e.approver_id,e.organization_id,(e.approver_id=v_request.target_profile_id) is_admin_required
        from expected e
      ),
      diff as (
        (select * from expected_normalized except select * from actual)
        union all
        (select * from actual except select * from expected_normalized)
      )
      select 1 from diff
    );
  end if;

  return false;
end;
$function$;

create or replace function private.naxa_cancel_cumulative_activity_request(
  p_request_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_request public.naxa_cumulative_activity_requests%rowtype;
begin
  select * into v_request
  from public.naxa_cumulative_activity_requests
  where id=p_request_id and status in ('pending','approved')
  for update;
  if not found then return; end if;

  update public.naxa_cumulative_activity_approvals
  set status='invalidated',
      decided_at=coalesce(decided_at,now()),
      decision_reason=left(coalesce(nullif(trim(p_reason),''),'Affectation source ou autorité modifiée'),500)
  where request_id=p_request_id and status in ('pending','approved');

  update public.naxa_cumulative_activity_requests
  set status='cancelled',updated_at=now()
  where id=p_request_id and status in ('pending','approved');

  insert into public.notifications(user_id,type,titre,corps,related_entity_id)
  select distinct recipients.user_id,
    'cumulative_activity_update',
    'Demande de cumul réinitialisée',
    left(coalesce(nullif(trim(p_reason),''),'Les affectations ou autorisations de votre demande ont changé. Une nouvelle demande est nécessaire.'),1000),
    p_request_id
  from (
    select v_request.target_profile_id user_id
    union select v_request.requested_by
    union
    select a.approver_id from public.naxa_cumulative_activity_approvals a
    where a.request_id=p_request_id
  ) recipients
  where recipients.user_id is not null;
end;
$function$;

create or replace function private.naxa_cancel_cumulative_requests_for_profile(
  p_profile_id uuid,
  p_direction text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare v_request_id uuid;
begin
  if p_profile_id is null then return; end if;
  for v_request_id in
    select r.id from public.naxa_cumulative_activity_requests r
    where r.target_profile_id=p_profile_id
      and r.direction=p_direction
      and r.status in ('pending','approved')
  loop
    perform private.naxa_cancel_cumulative_activity_request(v_request_id,p_reason);
  end loop;
end;
$function$;

create or replace function private.naxa_cancel_cumulative_requests_for_pharmacy(
  p_pharmacy_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare v_request_id uuid;
begin
  if p_pharmacy_id is null then return; end if;
  for v_request_id in
    select r.id from public.naxa_cumulative_activity_requests r
    where r.direction='SPD_VERS_PHARMACIE'
      and r.destination_pharmacy_id=p_pharmacy_id
      and r.status in ('pending','approved')
  loop
    perform private.naxa_cancel_cumulative_activity_request(v_request_id,p_reason);
  end loop;
end;
$function$;

create or replace function private.naxa_cumulative_source_change_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_profile_id uuid;
  v_partner_id uuid;
  v_pharmacy_id uuid;
  v_promoteur_id uuid;
  v_old_profile_id uuid;
  v_new_profile_id uuid;
  v_old_partner_id uuid;
  v_new_partner_id uuid;
  v_old_pharmacy_id uuid;
  v_new_pharmacy_id uuid;
  v_old_promoteur_id uuid;
  v_new_promoteur_id uuid;
  v_user_id uuid;
begin
  if tg_table_name='naxa_professional_assignments' then
    if tg_op='INSERT' then
      perform private.naxa_cancel_cumulative_requests_for_profile(new.profile_id,'PHARMACIE_VERS_SPD','Une affectation pharmacie a changé après la demande.');
    elsif tg_op='DELETE' then
      perform private.naxa_cancel_cumulative_requests_for_profile(old.profile_id,'PHARMACIE_VERS_SPD','Une affectation pharmacie a été révoquée.');
    elsif old.profile_id is distinct from new.profile_id
       or old.pharmacie_id is distinct from new.pharmacie_id
       or old.role_code is distinct from new.role_code
       or old.statut is distinct from new.statut
       or old.commence_at is distinct from new.commence_at
       or old.expire_at is distinct from new.expire_at then
      perform private.naxa_cancel_cumulative_requests_for_profile(old.profile_id,'PHARMACIE_VERS_SPD','Une affectation pharmacie a changé après la demande.');
      perform private.naxa_cancel_cumulative_requests_for_profile(new.profile_id,'PHARMACIE_VERS_SPD','Une affectation pharmacie a changé après la demande.');
    end if;

  elsif tg_table_name='promoteur_pharmacies' then
    if tg_op<>'INSERT' then
      v_old_pharmacy_id:=old.pharmacie_id;
      v_old_promoteur_id:=old.promoteur_id;
    end if;
    if tg_op<>'DELETE' then
      v_new_pharmacy_id:=new.pharmacie_id;
      v_new_promoteur_id:=new.promoteur_id;
    end if;
    for v_profile_id in
      select distinct a.profile_id from public.naxa_professional_assignments a
      where a.pharmacie_id in (v_old_pharmacy_id,v_new_pharmacy_id)
      union
      select p.id from public.profiles p
      where p.role::text in ('pharmacie','caisse') and p.pharmacie_id in (v_old_pharmacy_id,v_new_pharmacy_id)
      union select v_old_promoteur_id where v_old_promoteur_id is not null
      union select v_new_promoteur_id where v_new_promoteur_id is not null
    loop
      perform private.naxa_cancel_cumulative_requests_for_profile(v_profile_id,'PHARMACIE_VERS_SPD','Le réseau de Promoteurs ou les pharmacies concernées a changé.');
    end loop;

  elsif tg_table_name='partner_members' then
    if tg_op<>'INSERT' then
      v_old_partner_id:=old.partner_id;
      v_old_profile_id:=old.user_id;
    end if;
    if tg_op<>'DELETE' then
      v_new_partner_id:=new.partner_id;
      v_new_profile_id:=new.user_id;
    end if;
    if (tg_op='UPDATE' and (old.member_role='owner' or new.member_role='owner'))
       or (tg_op='DELETE' and old.member_role='owner')
       or (tg_op='INSERT' and new.member_role='owner') then
      for v_user_id in
        select pm.user_id from public.partner_members pm
        where pm.partner_id in (v_old_partner_id,v_new_partner_id)
        union select v_old_profile_id where v_old_profile_id is not null
        union select v_new_profile_id where v_new_profile_id is not null
      loop
        perform private.naxa_cancel_cumulative_requests_for_profile(v_user_id,'SPD_VERS_PHARMACIE','La composition ou le titulaire de l’espace SPD a changé.');
      end loop;
    else
      perform private.naxa_cancel_cumulative_requests_for_profile(v_old_profile_id,'SPD_VERS_PHARMACIE','Une affectation SPD a changé.');
      perform private.naxa_cancel_cumulative_requests_for_profile(v_new_profile_id,'SPD_VERS_PHARMACIE','Une affectation SPD a changé.');
    end if;

  elsif tg_table_name='partners' then
    v_partner_id:=old.id;
    for v_user_id in
      select pm.user_id from public.partner_members pm where pm.partner_id=v_partner_id
    loop
      perform private.naxa_cancel_cumulative_requests_for_profile(v_user_id,'SPD_VERS_PHARMACIE','Le statut de l’espace SPD a changé.');
    end loop;

  elsif tg_table_name='partner_universes' then
    v_partner_id:=old.partner_id;
    for v_user_id in
      select pm.user_id from public.partner_members pm where pm.partner_id=v_partner_id
    loop
      perform private.naxa_cancel_cumulative_requests_for_profile(v_user_id,'SPD_VERS_PHARMACIE','L’univers SPD a été activé ou désactivé.');
    end loop;

  elsif tg_table_name='pharmacies' then
    v_pharmacy_id:=old.id;
    for v_profile_id in
      select distinct a.profile_id from public.naxa_professional_assignments a where a.pharmacie_id=v_pharmacy_id
      union
      select p.id from public.profiles p where p.role::text in ('pharmacie','caisse') and p.pharmacie_id=v_pharmacy_id
      union
      select pp.promoteur_id from public.promoteur_pharmacies pp where pp.pharmacie_id=v_pharmacy_id
    loop
      perform private.naxa_cancel_cumulative_requests_for_profile(v_profile_id,'PHARMACIE_VERS_SPD','Le statut de la pharmacie source a changé.');
    end loop;
    perform private.naxa_cancel_cumulative_requests_for_pharmacy(v_pharmacy_id,'La pharmacie de destination a été suspendue ou archivée.');
  end if;

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$function$;

create or replace function private.naxa_guard_cumulative_spd_dossier()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare v_has_pharmacy_source boolean;
begin
  if new.universe_slug<>'prestations' then return new; end if;

  v_has_pharmacy_source :=
    exists(select 1 from public.naxa_professional_assignments a
      join public.pharmacies ph on ph.id=a.pharmacie_id and ph.actif=true and ph.archivee_le is null
      join public.promoteur_pharmacies pp on pp.pharmacie_id=ph.id and pp.actif=true
      where a.profile_id=new.promoteur_id and a.statut='active'
        and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now()))
    or exists(select 1 from public.promoteur_pharmacies pp
      join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
      where pp.promoteur_id=new.promoteur_id and pp.actif=true)
    or exists(select 1 from public.profiles p
      join public.pharmacies ph on ph.id=p.pharmacie_id and ph.actif=true and ph.archivee_le is null
      where p.id=new.promoteur_id and p.role::text in ('pharmacie','caisse'));

  if v_has_pharmacy_source and not exists(
    select 1 from public.naxa_cumulative_activity_requests r
    where r.target_profile_id=new.promoteur_id
      and r.direction='PHARMACIE_VERS_SPD' and r.status='approved'
      and private.naxa_cumulative_approval_set_current(r.id)
  ) then
    raise exception 'Accord actuel de tous les Promoteurs requis avant création du dossier SPD'
      using errcode='42501';
  end if;
  return new;
end;
$function$;

create or replace function private.naxa_guard_cumulative_pharmacy_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare v_role_code text;
begin
  if new.statut<>'active' then return new; end if;
  v_role_code:=coalesce(new.role_code,new.fonction);

  if exists(
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
      and pa.partner_type='professionnel_domicile' and pa.status='active'
    join public.partner_universes pu on pu.partner_id=pa.id
      and pu.universe_slug='prestations' and pu.enabled=true
    where pm.user_id=new.profile_id and pm.member_role in ('owner','manager','operator')
      and private.naxa_partner_has_confirmed_payment(pa.id)
  ) and not exists(
    select 1 from public.naxa_cumulative_activity_requests r
    where r.target_profile_id=new.profile_id
      and r.direction='SPD_VERS_PHARMACIE'
      and r.destination_pharmacy_id=new.pharmacie_id
      and r.destination_role_code=v_role_code
      and r.status='approved'
      and private.naxa_cumulative_approval_set_current(r.id)
  ) then
    raise exception 'Accord actuel des espaces SPD requis avant activation de cette affectation'
      using errcode='42501';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_naxa_cumulative_assignment_source_changed on public.naxa_professional_assignments;
create trigger trg_naxa_cumulative_assignment_source_changed
after insert or update or delete on public.naxa_professional_assignments
for each row execute function private.naxa_cumulative_source_change_trigger();

drop trigger if exists trg_naxa_cumulative_promoter_network_changed on public.promoteur_pharmacies;
create trigger trg_naxa_cumulative_promoter_network_changed
after insert or update or delete on public.promoteur_pharmacies
for each row execute function private.naxa_cumulative_source_change_trigger();

drop trigger if exists trg_naxa_cumulative_partner_membership_changed on public.partner_members;
create trigger trg_naxa_cumulative_partner_membership_changed
after insert or update or delete on public.partner_members
for each row execute function private.naxa_cumulative_source_change_trigger();

drop trigger if exists trg_naxa_cumulative_partner_status_changed on public.partners;
create trigger trg_naxa_cumulative_partner_status_changed
after update of status,partner_type on public.partners
for each row when (old.status is distinct from new.status or old.partner_type is distinct from new.partner_type)
execute function private.naxa_cumulative_source_change_trigger();

drop trigger if exists trg_naxa_cumulative_partner_universe_changed on public.partner_universes;
create trigger trg_naxa_cumulative_partner_universe_changed
after update of enabled,universe_slug on public.partner_universes
for each row when (old.enabled is distinct from new.enabled or old.universe_slug is distinct from new.universe_slug)
execute function private.naxa_cumulative_source_change_trigger();

drop trigger if exists trg_naxa_cumulative_pharmacy_status_changed on public.pharmacies;
create trigger trg_naxa_cumulative_pharmacy_status_changed
after update of actif,archivee_le on public.pharmacies
for each row when (old.actif is distinct from new.actif or old.archivee_le is distinct from new.archivee_le)
execute function private.naxa_cumulative_source_change_trigger();

drop trigger if exists trg_naxa_guard_cumulative_spd_dossier on public.admin_partner_dossiers;
create trigger trg_naxa_guard_cumulative_spd_dossier
before insert or update of promoteur_id,universe_slug on public.admin_partner_dossiers
for each row execute function private.naxa_guard_cumulative_spd_dossier();

drop trigger if exists trg_naxa_guard_cumulative_pharmacy_assignment on public.naxa_professional_assignments;
create trigger trg_naxa_guard_cumulative_pharmacy_assignment
before insert or update of profile_id,pharmacie_id,role_code,fonction,statut on public.naxa_professional_assignments
for each row execute function private.naxa_guard_cumulative_pharmacy_assignment();

create or replace function public.naxa_decide_cumulative_activity(
  p_approval_id uuid,
  p_decision text,
  p_reason text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_admin boolean:=false;
  v_approval public.naxa_cumulative_activity_approvals%rowtype;
  v_request public.naxa_cumulative_activity_requests%rowtype;
  v_authorized boolean:=false;
  v_pending integer;
  v_rejected integer;
  v_next_status text;
begin
  if v_actor is null then raise exception 'Connexion requise' using errcode='42501'; end if;
  if p_decision not in ('approve','reject') then raise exception 'Décision invalide' using errcode='22023'; end if;
  if p_decision='reject' and length(trim(coalesce(p_reason,'')))<5 then
    raise exception 'Un motif de refus de 5 caractères minimum est obligatoire' using errcode='22023';
  end if;
  if length(trim(coalesce(p_reason,'')))>500 then raise exception 'Motif trop long' using errcode='22023'; end if;

  v_admin:=public.is_admin();
  select * into v_approval from public.naxa_cumulative_activity_approvals
  where id=p_approval_id for update;
  if not found or v_approval.status<>'pending' then
    raise exception 'Approbation absente ou déjà traitée' using errcode='23514';
  end if;
  select * into v_request from public.naxa_cumulative_activity_requests
  where id=v_approval.request_id for update;
  if not found or v_request.status<>'pending' then
    raise exception 'Demande absente ou déjà clôturée' using errcode='23514';
  end if;

  if not private.naxa_cumulative_approval_set_current(v_request.id) then
    perform private.naxa_cancel_cumulative_activity_request(
      v_request.id,'Les affectations sources ou les autorités ont changé depuis la création de la demande. Une nouvelle demande est nécessaire.'
    );
    return 'cancelled';
  end if;

  if v_admin and not v_approval.is_admin_required then
    raise exception 'L’Administrateur ne remplace pas les accords organisationnels ordinaires' using errcode='42501';
  end if;

  if not v_admin then
    if v_approval.is_admin_required or v_approval.approver_id<>v_actor then
      raise exception 'Cette décision est réservée à l’Administrateur NAXA' using errcode='42501';
    end if;
    if v_approval.organization_type='pharmacie' then
      v_authorized:=private.naxa_promoteur_valide(v_actor)
        and exists(select 1 from public.promoteur_pharmacies pp
          join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
          where pp.promoteur_id=v_actor and pp.pharmacie_id=v_approval.organization_id and pp.actif=true);
    elsif v_approval.organization_type='spd' then
      v_authorized:=exists(select 1 from public.partner_members pm
        join public.partners pa on pa.id=pm.partner_id and pa.partner_type='professionnel_domicile' and pa.status='active'
        join public.partner_universes pu on pu.partner_id=pa.id and pu.universe_slug='prestations' and pu.enabled=true
        where pm.partner_id=v_approval.organization_id and pm.user_id=v_actor and pm.member_role='owner');
    end if;
    if not v_authorized then
      perform private.naxa_cancel_cumulative_activity_request(
        v_request.id,'L’autorité d’approbation a été révoquée ou son organisation est inactive.'
      );
      return 'cancelled';
    end if;
  end if;

  update public.naxa_cumulative_activity_approvals
  set status=case when p_decision='approve' then 'approved' else 'rejected' end,
      decided_at=now(),decision_reason=nullif(trim(coalesce(p_reason,'')),'')
  where id=p_approval_id;

  if p_decision='reject' then
    update public.naxa_cumulative_activity_requests
    set status='rejected',updated_at=now()
    where id=v_request.id;
    update public.naxa_cumulative_activity_approvals
    set status='invalidated',decided_at=coalesce(decided_at,now()),
        decision_reason=coalesce(decision_reason,'Demande refusée par une autre organisation')
    where request_id=v_request.id and status='pending';
    v_next_status:='rejected';
  else
    select count(*) filter(where status='pending'),
           count(*) filter(where status='rejected')
    into v_pending,v_rejected
    from public.naxa_cumulative_activity_approvals
    where request_id=v_request.id;
    if v_pending=0 and v_rejected=0 then
      update public.naxa_cumulative_activity_requests
      set status='approved',updated_at=now()
      where id=v_request.id;
      v_next_status:='approved';
    else
      v_next_status:='pending';
    end if;
  end if;

  insert into public.notifications(user_id,type,titre,corps,related_entity_id)
  select distinct recipients.user_id,'cumulative_activity_update',
    case when v_next_status='approved' then 'Cumul professionnel approuvé'
         when v_next_status='rejected' then 'Demande de cumul refusée'
         else 'Décision de cumul enregistrée' end,
    case when v_next_status='approved' then 'Toutes les autorisations organisationnelles sont réunies. Le dossier peut poursuivre son parcours Admin.'
         when v_next_status='rejected' then 'Une organisation a refusé la demande de cumul. Aucun nouvel accès professionnel n’est activé.'
         else 'Une autorisation a été enregistrée ; d’autres décisions sont encore attendues.' end,
    v_request.id
  from (values(v_request.target_profile_id),(v_request.requested_by)) recipients(user_id);
  return v_next_status;
end
$function$;

revoke all on function private.naxa_cumulative_approval_set_current(uuid) from public,anon,authenticated;
revoke all on function private.naxa_cancel_cumulative_activity_request(uuid,text) from public,anon,authenticated;
revoke all on function private.naxa_cancel_cumulative_requests_for_profile(uuid,text,text) from public,anon,authenticated;
revoke all on function private.naxa_cancel_cumulative_requests_for_pharmacy(uuid,text) from public,anon,authenticated;
revoke all on function private.naxa_cumulative_source_change_trigger() from public,anon,authenticated;
revoke all on function private.naxa_guard_cumulative_spd_dossier() from public,anon,authenticated;
revoke all on function private.naxa_guard_cumulative_pharmacy_assignment() from public,anon,authenticated;
