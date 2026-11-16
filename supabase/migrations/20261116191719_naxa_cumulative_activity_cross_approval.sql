begin;

create table if not exists public.naxa_cumulative_activity_requests (
  id uuid primary key default gen_random_uuid(),
  target_profile_id uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id),
  direction text not null check(direction in ('PHARMACIE_VERS_SPD','SPD_VERS_PHARMACIE')),
  destination_pharmacy_id uuid null references public.pharmacies(id),
  destination_partner_id uuid null references public.partners(id),
  destination_role_code text null,
  reason text not null check(length(trim(reason)) between 5 and 500),
  target_display_name text not null,
  status text not null default 'pending'
    check(status in ('pending','approved','rejected','cancelled','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (
    (direction='PHARMACIE_VERS_SPD' and destination_pharmacy_id is null
      and destination_partner_id is null and destination_role_code is null)
    or
    (direction='SPD_VERS_PHARMACIE' and destination_pharmacy_id is not null
      and destination_partner_id is null and destination_role_code is not null)
  )
);

create table if not exists public.naxa_cumulative_activity_approvals (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.naxa_cumulative_activity_requests(id) on delete cascade,
  approver_id uuid not null references public.profiles(id),
  organization_type text not null check(organization_type in ('pharmacie','spd')),
  organization_id uuid not null,
  organization_label text not null,
  is_admin_required boolean not null default false,
  status text not null default 'pending'
    check(status in ('pending','approved','rejected','invalidated')),
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  unique(request_id,organization_type,organization_id,approver_id)
);

create index if not exists naxa_cumulative_requests_target_status_idx
  on public.naxa_cumulative_activity_requests(target_profile_id,direction,status,created_at desc);
create index if not exists naxa_cumulative_approvals_approver_status_idx
  on public.naxa_cumulative_activity_approvals(approver_id,status,created_at desc);
create index if not exists naxa_cumulative_approvals_request_status_idx
  on public.naxa_cumulative_activity_approvals(request_id,status);

alter table public.naxa_cumulative_activity_requests enable row level security;
alter table public.naxa_cumulative_activity_approvals enable row level security;

create or replace function private.naxa_can_read_cumulative_activity(p_request_id uuid)
returns boolean
language sql stable security definer set search_path=''
as $function$
 select p_request_id is not null and auth.uid() is not null and (
   public.is_admin()
   or exists(select 1 from public.naxa_cumulative_activity_requests r
     where r.id=p_request_id and (r.target_profile_id=auth.uid() or r.requested_by=auth.uid()))
   or exists(select 1 from public.naxa_cumulative_activity_approvals a
     where a.request_id=p_request_id and a.approver_id=auth.uid())
 )
$function$;

revoke all on function private.naxa_can_read_cumulative_activity(uuid) from public,anon;
grant execute on function private.naxa_can_read_cumulative_activity(uuid) to authenticated;

drop policy if exists naxa_cumulative_requests_read_participants on public.naxa_cumulative_activity_requests;
create policy naxa_cumulative_requests_read_participants
on public.naxa_cumulative_activity_requests for select to authenticated
using(private.naxa_can_read_cumulative_activity(id));

drop policy if exists naxa_cumulative_approvals_read_participants on public.naxa_cumulative_activity_approvals;
create policy naxa_cumulative_approvals_read_participants
on public.naxa_cumulative_activity_approvals for select to authenticated
using(private.naxa_can_read_cumulative_activity(request_id));

revoke all on public.naxa_cumulative_activity_requests from anon,authenticated;
revoke all on public.naxa_cumulative_activity_approvals from anon,authenticated;
grant select on public.naxa_cumulative_activity_requests to authenticated;
grant select on public.naxa_cumulative_activity_approvals to authenticated;

create or replace function public.naxa_request_cumulative_activity(
 p_target_profile_id uuid,
 p_direction text,
 p_destination_pharmacy_id uuid default null,
 p_destination_partner_id uuid default null,
 p_destination_role_code text default null,
 p_reason text default null
)
returns uuid
language plpgsql security definer set search_path=''
as $function$
declare
 v_actor uuid:=auth.uid();
 v_existing public.naxa_cumulative_activity_requests%rowtype;
 v_target public.profiles%rowtype;
 v_actor_role text;
 v_request_id uuid;
 v_count integer:=0;
 v_has_source boolean:=false;
 r record;
 v_admin_required boolean;
begin
 if v_actor is null then raise exception 'Connexion requise' using errcode='42501'; end if;
 if p_target_profile_id is null or length(trim(coalesce(p_reason,'')))<5
   or length(trim(coalesce(p_reason,'')))>500 then
   raise exception 'Cible ou motif invalide' using errcode='22023';
 end if;
 select * into v_target from public.profiles where id=p_target_profile_id and actif=true;
 if not found or v_target.age_verified is not true or v_target.consent_accepted_at is null
   or v_target.username is null or v_target.first_name is null or v_target.last_name is null
   or v_target.phone is null or v_target.date_of_birth is null
   or v_target.date_of_birth>(current_date-interval '18 years')::date then
   raise exception 'Identité cible inactive, incomplète ou non majeure' using errcode='23514';
 end if;

 if p_direction='PHARMACIE_VERS_SPD' then
   if p_destination_pharmacy_id is not null or p_destination_partner_id is not null
     or p_destination_role_code is not null then
     raise exception 'Destination SPD invalide' using errcode='22023';
   end if;
   if v_actor<>p_target_profile_id and not public.is_admin() then
     raise exception 'Seule la personne concernée ou l’Admin peut demander ce cumul' using errcode='42501';
   end if;
   v_has_source :=
     exists(select 1 from public.naxa_professional_assignments a
       where a.profile_id=p_target_profile_id and a.statut='active'
         and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now()))
     or exists(select 1 from public.promoteur_pharmacies pp
       where pp.promoteur_id=p_target_profile_id and pp.actif=true)
     or exists(select 1 from public.profiles p
       where p.id=p_target_profile_id and p.role::text in ('pharmacie','caisse')
         and p.pharmacie_id is not null);
 elsif p_direction='SPD_VERS_PHARMACIE' then
   if p_destination_pharmacy_id is null or p_destination_partner_id is not null
     or p_destination_role_code is null then
     raise exception 'Destination Pharmacie invalide' using errcode='22023';
   end if;
   if not exists(select 1 from public.naxa_roles role_row
     where role_row.code=p_destination_role_code and role_row.actif=true
       and role_row.assignable=true and role_row.portee='PHARMACIE') then
     raise exception 'Rôle Pharmacie non attribuable' using errcode='22023';
   end if;
   if not exists(select 1 from public.pharmacies ph
     where ph.id=p_destination_pharmacy_id and ph.actif=true and ph.archivee_le is null) then
     raise exception 'Pharmacie destination inactive' using errcode='23514';
   end if;
   v_actor_role:=private.naxa_business_function(v_actor);
   if not public.is_admin() then
     if v_actor_role='promoteur' then
       if not private.naxa_promoteur_valide(v_actor) or not exists(
         select 1 from public.promoteur_pharmacies pp
         where pp.promoteur_id=v_actor and pp.pharmacie_id=p_destination_pharmacy_id and pp.actif=true
       ) then raise exception 'Pharmacie hors réseau du Promoteur' using errcode='42501'; end if;
     elsif v_actor_role='pharmacie' then
       if private.naxa_active_role_pharmacy(v_actor) is distinct from p_destination_pharmacy_id then
         raise exception 'Pharmacie active différente de la destination' using errcode='42501';
       end if;
     else
       raise exception 'Seul le Promoteur ou la Pharmacie destination peut demander cette affectation' using errcode='42501';
     end if;
   end if;
   v_has_source:=exists(
     select 1 from public.partner_members pm
     join public.partners pa on pa.id=pm.partner_id and pa.partner_type='professionnel_domicile' and pa.status='active'
     join public.partner_universes pu on pu.partner_id=pa.id and pu.universe_slug='prestations' and pu.enabled=true
     where pm.user_id=p_target_profile_id and pm.member_role in ('owner','manager','operator')
   );
 else
   raise exception 'Direction de cumul inconnue' using errcode='22023';
 end if;

 if not v_has_source then return null; end if;

 select * into v_existing
 from public.naxa_cumulative_activity_requests request_row
 where request_row.target_profile_id=p_target_profile_id and request_row.direction=p_direction
   and request_row.destination_pharmacy_id is not distinct from p_destination_pharmacy_id
   and request_row.destination_partner_id is not distinct from p_destination_partner_id
   and request_row.destination_role_code is not distinct from p_destination_role_code
   and request_row.status in ('pending','approved','rejected')
 order by request_row.created_at desc limit 1 for update;
 if found then
   if v_existing.status='approved' then return null; end if;
   if v_existing.status='pending' then return v_existing.id; end if;
   raise exception 'Une demande équivalente a déjà été refusée ; une nouvelle décision Admin est nécessaire' using errcode='23514';
 end if;

 insert into public.naxa_cumulative_activity_requests(
   target_profile_id,requested_by,direction,destination_pharmacy_id,destination_partner_id,
   destination_role_code,reason,target_display_name,status
 ) values(
   p_target_profile_id,v_actor,p_direction,p_destination_pharmacy_id,p_destination_partner_id,
   p_destination_role_code,trim(p_reason),
   coalesce(nullif(trim(concat_ws(' ',v_target.first_name,v_target.last_name)),''),v_target.username),
   'pending'
 ) returning id into v_request_id;

 if p_direction='PHARMACIE_VERS_SPD' then
   for r in
     select distinct pp.promoteur_id approver_id,pp.pharmacie_id organization_id,ph.nom organization_label
     from public.naxa_professional_assignments a
     join public.promoteur_pharmacies pp on pp.pharmacie_id=a.pharmacie_id and pp.actif=true
     join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
     where a.profile_id=p_target_profile_id and a.statut='active'
       and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now())
     union
     select distinct pp.promoteur_id,pp.pharmacie_id,ph.nom
     from public.promoteur_pharmacies pp
     join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
     where pp.promoteur_id=p_target_profile_id and pp.actif=true
     union
     select distinct pp.promoteur_id,pp.pharmacie_id,ph.nom
     from public.profiles p
     join public.promoteur_pharmacies pp on pp.pharmacie_id=p.pharmacie_id and pp.actif=true
     join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
     where p.id=p_target_profile_id and p.role::text in ('pharmacie','caisse')
   loop
     v_admin_required:=r.approver_id=p_target_profile_id;
     insert into public.naxa_cumulative_activity_approvals(
       request_id,approver_id,organization_type,organization_id,organization_label,is_admin_required
     ) values(v_request_id,r.approver_id,'pharmacie',r.organization_id,r.organization_label,v_admin_required);
     v_count:=v_count+1;
     if v_admin_required then
       insert into public.notifications(user_id,type,titre,corps,related_entity_id)
       select p.id,'cumulative_activity_request','Arbitrage Admin requis',
         'Un candidat Promoteur demande un cumul avec SPD. Votre arbitrage est requis.',v_request_id
       from public.profiles p where p.role::text='admin' and p.actif=true;
     else
       insert into public.notifications(user_id,type,titre,corps,related_entity_id)
       values(r.approver_id,'cumulative_activity_request','Demande de cumul professionnel',
         'Un membre de votre pharmacie souhaite ouvrir un espace Soins & Prestations à domicile. Répondez dans NAXA.',v_request_id);
     end if;
   end loop;
 elsif p_direction='SPD_VERS_PHARMACIE' then
   for r in
     select distinct owner.user_id approver_id,pa.id organization_id,pa.name organization_label
     from public.partner_members member
     join public.partners pa on pa.id=member.partner_id
       and pa.partner_type='professionnel_domicile' and pa.status='active'
     join public.partner_universes pu on pu.partner_id=pa.id
       and pu.universe_slug='prestations' and pu.enabled=true
     join public.partner_members owner on owner.partner_id=pa.id and owner.member_role='owner'
     where member.user_id=p_target_profile_id and member.member_role in ('owner','manager','operator')
   loop
     v_admin_required:=r.approver_id=p_target_profile_id;
     insert into public.naxa_cumulative_activity_approvals(
       request_id,approver_id,organization_type,organization_id,organization_label,is_admin_required
     ) values(v_request_id,r.approver_id,'spd',r.organization_id,r.organization_label,v_admin_required);
     v_count:=v_count+1;
     if v_admin_required then
       insert into public.notifications(user_id,type,titre,corps,related_entity_id)
       select p.id,'cumulative_activity_request','Arbitrage Admin requis',
         'Un titulaire SPD souhaite rejoindre une pharmacie. Votre arbitrage est requis.',v_request_id
       from public.profiles p where p.role::text='admin' and p.actif=true;
     else
       insert into public.notifications(user_id,type,titre,corps,related_entity_id)
       values(r.approver_id,'cumulative_activity_request','Demande de cumul professionnel',
         'Un membre de votre espace SPD souhaite rejoindre une pharmacie. Répondez dans NAXA.',v_request_id);
     end if;
   end loop;
 end if;

 if v_count=0 then
   delete from public.naxa_cumulative_activity_requests where id=v_request_id;
   raise exception 'Aucune autorité valide trouvée pour approuver ce cumul' using errcode='23514';
 end if;
 return v_request_id;
end
$function$;

create or replace function public.naxa_decide_cumulative_activity(
 p_approval_id uuid,p_decision text,p_reason text default null
)
returns text
language plpgsql security definer set search_path=''
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
     update public.naxa_cumulative_activity_approvals
     set status='invalidated',decided_at=now(),decision_reason='Autorité révoquée ou organisation inactive'
     where id=p_approval_id;
     update public.naxa_cumulative_activity_requests
     set status='cancelled',updated_at=now()
     where id=v_request.id;
     update public.naxa_cumulative_activity_approvals
     set status='invalidated',decided_at=coalesce(decided_at,now()),
         decision_reason=coalesce(decision_reason,'Demande annulée après perte d''autorité')
     where request_id=v_request.id and status='pending';
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

revoke all on function public.naxa_request_cumulative_activity(uuid,text,uuid,uuid,text,text) from public,anon;
grant execute on function public.naxa_request_cumulative_activity(uuid,text,uuid,uuid,text,text) to authenticated;
revoke all on function public.naxa_decide_cumulative_activity(uuid,text,text) from public,anon;
grant execute on function public.naxa_decide_cumulative_activity(uuid,text,text) to authenticated;

do $patch$
declare v_definition text; v_old text; v_new text;
begin
 select pg_get_functiondef('public.naxa_grant_professional_assignment(uuid,uuid,text,timestamp with time zone,timestamp with time zone,text)'::regprocedure)
 into v_definition;
 v_old := '  if not exists(select 1 from public.pharmacies ph where ph.id=p_pharmacie and ph.actif=true) then';
 v_new := $guard$
  if exists(
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
      and pa.partner_type='professionnel_domicile' and pa.status='active'
    join public.partner_universes pu on pu.partner_id=pa.id
      and pu.universe_slug='prestations' and pu.enabled=true
    where pm.user_id=p_target and pm.member_role in ('owner','manager','operator')
  ) and not exists(
    select 1 from public.naxa_cumulative_activity_requests r
    where r.target_profile_id=p_target and r.direction='SPD_VERS_PHARMACIE'
      and r.destination_pharmacy_id=p_pharmacie and r.destination_role_code=p_fonction
      and r.status='approved'
  ) then
    raise exception 'Accord SPD requis avant activation de cette affectation' using errcode='42501';
  end if;
$guard$ || v_old;
 if position('Accord SPD requis avant activation' in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Pharmacy assignment guard anchor changed'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
 end if;
 v_old := '  return v_id;';
 v_new := $complete$
  update public.naxa_cumulative_activity_requests
  set status='completed',completed_at=now(),updated_at=now()
  where target_profile_id=p_target and direction='SPD_VERS_PHARMACIE'
    and destination_pharmacy_id=p_pharmacie and destination_role_code=p_fonction
    and status='approved';
  return v_id;
$complete$;
 if position('set status=''completed''' in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Pharmacy assignment completion anchor changed'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
 end if;
 execute v_definition;

 select pg_get_functiondef('public.naxa_grant_livreur_assignment(uuid,uuid,timestamp with time zone,timestamp with time zone,text)'::regprocedure)
 into v_definition;
 v_old := '  if not exists(select 1 from public.pharmacies ph';
 v_new := $guard$
  if exists(
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
      and pa.partner_type='professionnel_domicile' and pa.status='active'
    join public.partner_universes pu on pu.partner_id=pa.id
      and pu.universe_slug='prestations' and pu.enabled=true
    where pm.user_id=p_target and pm.member_role in ('owner','manager','operator')
  ) and not exists(
    select 1 from public.naxa_cumulative_activity_requests r
    where r.target_profile_id=p_target and r.direction='SPD_VERS_PHARMACIE'
      and r.destination_pharmacy_id=p_pharmacie and r.destination_role_code='livreur'
      and r.status='approved'
  ) then
    raise exception 'Accord SPD requis avant activation de cette affectation Livreur' using errcode='42501';
  end if;
$guard$ || v_old;
 if position('Accord SPD requis avant activation de cette affectation Livreur' in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Courier assignment guard anchor changed'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
 end if;
 v_old := '  return v_id;';
 v_new := $complete$
  update public.naxa_cumulative_activity_requests
  set status='completed',completed_at=now(),updated_at=now()
  where target_profile_id=p_target and direction='SPD_VERS_PHARMACIE'
    and destination_pharmacy_id=p_pharmacie and destination_role_code='livreur'
    and status='approved';
  return v_id;
$complete$;
 if position('set status=''completed''' in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Courier assignment completion anchor changed'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
 end if;
 execute v_definition;

 select pg_get_functiondef('public.admin_create_partner_dossier(uuid,text,text,text,text,text,text,numeric,numeric,text,bigint,text,jsonb)'::regprocedure)
 into v_definition;
 v_old := ' if not public.is_admin() then raise exception ''Accès administrateur requis'' using errcode=''42501''; end if;';
 v_new := v_old || $guard$
 if p_universe_slug='prestations' and (
   exists(select 1 from public.naxa_professional_assignments a
     where a.profile_id=p_owner_user_id and a.statut='active'
       and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now()))
   or exists(select 1 from public.promoteur_pharmacies pp
     where pp.promoteur_id=p_owner_user_id and pp.actif=true)
   or exists(select 1 from public.profiles p where p.id=p_owner_user_id
     and p.role::text in ('pharmacie','caisse') and p.pharmacie_id is not null)
 ) and not exists(
   select 1 from public.naxa_cumulative_activity_requests r
   where r.target_profile_id=p_owner_user_id and r.direction='PHARMACIE_VERS_SPD'
     and r.status='approved'
 ) then
   raise exception 'Accord de tous les Promoteurs requis avant la création du dossier SPD' using errcode='42501';
 end if;
$guard$;
 if position('Accord de tous les Promoteurs requis' in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Admin dossier approval anchor changed'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
 end if;
 v_old := ' return v_partner_id;';
 v_new := $complete$
 update public.naxa_cumulative_activity_requests
 set status='completed',completed_at=now(),updated_at=now()
 where target_profile_id=p_owner_user_id and direction='PHARMACIE_VERS_SPD' and status='approved';
 return v_partner_id;
$complete$;
 if position('set status=''completed''' in v_definition)=0 then
   if position(v_old in v_definition)=0 then raise exception 'Admin dossier completion anchor changed'; end if;
   v_definition:=replace(v_definition,v_old,v_new);
 end if;
 execute v_definition;
end
$patch$;

commit;
