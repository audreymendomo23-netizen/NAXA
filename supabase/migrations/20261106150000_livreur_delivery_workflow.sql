-- NAXA — workflow Livreur de bout en bout.
-- Missions distinctes des commandes : aucune copie du panier, du stock ou du paiement.
begin;

create table if not exists public.naxa_delivery_missions (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.reservations(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  client_id uuid not null references public.profiles(id) on delete restrict,
  livreur_id uuid references public.profiles(id) on delete restrict,
  statut text not null default 'available'
    check (statut in ('available','accepted','picked_up','arrived','delivered','failed','cancelled')),
  ready_by uuid not null references public.profiles(id) on delete restrict,
  ready_at timestamptz not null default now(),
  accepted_at timestamptz,
  picked_up_at timestamptz,
  arrived_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  failure_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint naxa_delivery_mission_driver_ck check (
    (statut='available' and livreur_id is null)
    or (statut<>'available' and livreur_id is not null)
  ),
  constraint naxa_delivery_failure_ck check (
    (statut<>'failed') or (failed_at is not null and failure_code is not null)
  )
);

create index if not exists naxa_delivery_missions_pharmacy_status_idx
  on public.naxa_delivery_missions(pharmacie_id,statut,ready_at desc);
create index if not exists naxa_delivery_missions_courier_status_idx
  on public.naxa_delivery_missions(livreur_id,statut,created_at desc);
create index if not exists naxa_delivery_missions_client_idx
  on public.naxa_delivery_missions(client_id,created_at desc);

create table if not exists public.naxa_delivery_events (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.naxa_delivery_missions(id) on delete restrict,
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (event_type in (
    'ready','accepted','picked_up','location','arrived','delivered','failed','reoffered','cancelled'
  )),
  label text not null,
  detail text,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  created_at timestamptz not null default now(),
  constraint naxa_delivery_events_lat_ck check (latitude is null or latitude between -90 and 90),
  constraint naxa_delivery_events_lng_ck check (longitude is null or longitude between -180 and 180),
  constraint naxa_delivery_events_accuracy_ck check (accuracy_m is null or accuracy_m between 0 and 10000)
);
create index if not exists naxa_delivery_events_mission_time_idx
  on public.naxa_delivery_events(mission_id,created_at,id);
create index if not exists naxa_delivery_events_reservation_time_idx
  on public.naxa_delivery_events(reservation_id,created_at,id);

alter table public.naxa_delivery_missions enable row level security;
alter table public.naxa_delivery_events enable row level security;
revoke all on public.naxa_delivery_missions from public,anon,authenticated;
revoke all on public.naxa_delivery_events from public,anon,authenticated;
grant select on public.naxa_delivery_missions to authenticated;
grant select on public.naxa_delivery_events to authenticated;

drop policy if exists naxa_delivery_mission_participant_read on public.naxa_delivery_missions;
create policy naxa_delivery_mission_participant_read
on public.naxa_delivery_missions for select to authenticated
using (
  client_id=(select auth.uid())
  or livreur_id=(select auth.uid())
  or (
    statut='available'
    and exists (
      select 1 from public.naxa_professional_assignments a
      join public.profiles p on p.id=a.profile_id and p.actif=true
      where a.profile_id=(select auth.uid())
        and a.role_code='livreur' and a.pharmacie_id=naxa_delivery_missions.pharmacie_id
        and a.statut='active' and a.commence_at<=now()
        and (a.expire_at is null or a.expire_at>now())
    )
  )
  or public.naxa_scope_allows((select auth.uid()),pharmacie_id,'PHARMACIE')
);
drop policy if exists naxa_delivery_event_participant_read on public.naxa_delivery_events;
create policy naxa_delivery_event_participant_read
on public.naxa_delivery_events for select to authenticated
using (
  exists (
    select 1 from public.naxa_delivery_missions m
    where m.id=naxa_delivery_events.mission_id
      and (
        m.client_id=(select auth.uid())
        or m.livreur_id=(select auth.uid())
        or public.naxa_scope_allows((select auth.uid()),m.pharmacie_id,'PHARMACIE')
      )
  )
);

comment on table public.naxa_delivery_missions is
  'Mission unique liée à une commande Marketplace NAXA. Une mission est publiée uniquement après préparation physique par Stock.';
comment on table public.naxa_delivery_events is
  'Journal append-only du parcours de livraison et des positions volontairement partagées par le livreur.';

-- Un compte Livreur peut être rattaché à plusieurs pharmacies, mais jamais à un autre poste professionnel.
create or replace function private.naxa_livreur_assignment_exclusivity()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_profile_role text;
begin
  if new.statut<>'active' then return new; end if;

  select p.role::text into v_profile_role
  from public.profiles p where p.id=new.profile_id and p.actif=true;
  if v_profile_role is null then raise exception 'Le compte cible doit être actif'; end if;

  if new.role_code='livreur' then
    if v_profile_role<>'client' then
      raise exception 'Un compte Livreur doit conserver une identité de base Client';
    end if;
    if exists (
      select 1 from public.naxa_professional_assignments a
      where a.profile_id=new.profile_id and a.id is distinct from new.id
        and a.statut='active'
        and a.commence_at<coalesce(new.expire_at,'infinity'::timestamptz)
        and (a.expire_at is null or a.expire_at>new.commence_at)
        and a.role_code<>'livreur'
    ) then
      raise exception 'Ce compte possède déjà un autre poste professionnel : le compte Livreur doit rester exclusif';
    end if;
  elsif exists (
    select 1 from public.naxa_professional_assignments a
    where a.profile_id=new.profile_id and a.id is distinct from new.id
      and a.role_code='livreur' and a.statut='active'
      and a.commence_at<coalesce(new.expire_at,'infinity'::timestamptz)
      and (a.expire_at is null or a.expire_at>new.commence_at)
  ) then
    raise exception 'Un compte Livreur ne peut pas recevoir un autre poste professionnel';
  end if;
  return new;
end;
$function$;

drop trigger if exists naxa_livreur_assignment_exclusivity_trg on public.naxa_professional_assignments;
create trigger naxa_livreur_assignment_exclusivity_trg
before insert or update of profile_id,role_code,statut,commence_at,expire_at
on public.naxa_professional_assignments
for each row execute function private.naxa_livreur_assignment_exclusivity();

-- Attribution ciblée : Promoteur dans son réseau, ou compte Pharmacie dans sa pharmacie.
create or replace function public.naxa_grant_livreur_assignment(
  p_target uuid,
  p_pharmacie uuid,
  p_commence_at timestamptz,
  p_expire_at timestamptz default null,
  p_motif text default 'Affectation Livreur'
) returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_actor_role text;
  v_id uuid;
begin
  if v_actor is null then raise exception 'Connexion requise'; end if;
  if p_target is null or p_pharmacie is null or p_target=v_actor then
    raise exception 'Compte cible ou pharmacie invalide';
  end if;
  if p_commence_at is null or p_commence_at>now()+interval '1 minute'
    or (p_expire_at is not null and p_expire_at<=greatest(now(),p_commence_at)) then
    raise exception 'Période d’affectation invalide';
  end if;
  if p_motif is null or length(trim(p_motif))<5 or length(trim(p_motif))>500 then
    raise exception 'Motif obligatoire (5 à 500 caractères)';
  end if;
  if not exists(select 1 from public.profiles p where p.id=p_target and p.actif=true and p.role::text='client') then
    raise exception 'Le compte Livreur doit être un compte Client actif';
  end if;
  if not exists(select 1 from public.pharmacies ph where ph.id=p_pharmacie and ph.actif=true and ph.archivee_le is null) then
    raise exception 'Pharmacie inactive ou introuvable';
  end if;

  v_actor_role:=public.naxa_business_function(v_actor);
  if public.is_admin() then
    null;
  elsif v_actor_role='promoteur' then
    if not private.naxa_promoteur_valide(v_actor)
      or not exists(select 1 from public.promoteur_pharmacies pp
        where pp.promoteur_id=v_actor and pp.pharmacie_id=p_pharmacie and pp.actif) then
      raise exception 'Pharmacie hors réseau du Promoteur';
    end if;
    if not public.naxa_has_privilege('ASSIGN_USER_TO_PHARMACY',p_pharmacie,'PHARMACIE') then
      raise exception 'Privilège ASSIGN_USER_TO_PHARMACY absent';
    end if;
  elsif v_actor_role='pharmacie'
    and public.naxa_active_role_pharmacy(v_actor)=p_pharmacie
    and public.naxa_scope_allows(v_actor,p_pharmacie,'PHARMACIE') then
    null;
  else
    raise exception 'Seul le Promoteur du réseau ou le compte Pharmacie concerné peut affecter un Livreur';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_target::text||':livreur',0));
  if exists (
    select 1 from public.naxa_professional_assignments a
    where a.profile_id=p_target and a.pharmacie_id=p_pharmacie
      and a.role_code='livreur' and a.statut='active'
      and (a.expire_at is null or a.expire_at>p_commence_at)
      and (p_expire_at is null or a.commence_at<p_expire_at)
  ) then
    raise exception 'Ce compte est déjà affecté comme Livreur dans cette pharmacie pendant cette période';
  end if;

  insert into public.naxa_professional_assignments(
    profile_id,pharmacie_id,fonction,role_code,statut,nature_affectation,motif,
    commence_at,expire_at,accorde_par
  ) values(
    p_target,p_pharmacie,'livreur','livreur','active',
    case when p_expire_at is null then 'ordinaire' else 'urgence' end,
    trim(p_motif),p_commence_at,p_expire_at,v_actor
  ) returning id into v_id;

  return v_id;
end;
$function$;
revoke all on function public.naxa_grant_livreur_assignment(uuid,uuid,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.naxa_grant_livreur_assignment(uuid,uuid,timestamptz,timestamptz,text) to authenticated;

-- Une révocation ne peut pas abandonner un colis déjà accepté ou sorti de la pharmacie.
create or replace function private.naxa_block_livreur_revoke_with_open_delivery()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if old.role_code='livreur' and old.statut='active' and new.statut<>'active'
    and exists (
      select 1 from public.naxa_delivery_missions m
      where m.livreur_id=old.profile_id and m.pharmacie_id=old.pharmacie_id
        and m.statut in ('accepted','picked_up','arrived')
    ) then
    raise exception 'Réaffectez ou clôturez les livraisons en cours avant de révoquer ce Livreur';
  end if;
  return new;
end;
$function$;
drop trigger if exists naxa_block_livreur_revoke_open_delivery_trg on public.naxa_professional_assignments;
create trigger naxa_block_livreur_revoke_open_delivery_trg
before update of statut on public.naxa_professional_assignments
for each row execute function private.naxa_block_livreur_revoke_with_open_delivery();

-- Mission publiée exclusivement par un poste Stock après préparation réelle de la commande.
create or replace function public.naxa_delivery_make_available(p_reservation uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_r public.reservations%rowtype;
  v_mission uuid;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select * into v_r from public.reservations where id=p_reservation for update;
  if not found or v_r.mode<>'commande' then raise exception 'Commande de livraison introuvable'; end if;
  if not public.naxa_scope_allows(v_uid,v_r.pharmacie_id,'PHARMACIE') then
    raise exception 'Commande hors périmètre pharmacie';
  end if;
  v_role:=public.naxa_business_function(v_uid);
  if not public.is_admin() and v_role not in ('gestionnaire_stock','magasinier') then
    raise exception 'Seul le poste Gestionnaire de stock ou Magasinier peut publier une livraison prête';
  end if;
  if v_r.commande_statut<>'preparation' then
    raise exception 'La commande doit être en préparation avant de rejoindre la file Livreur';
  end if;
  if v_r.statut in ('annulee','expiree','retiree') then
    raise exception 'Cette commande n’est plus livrable';
  end if;

  select id into v_mission from public.naxa_delivery_missions
  where reservation_id=p_reservation and statut not in ('cancelled');
  if v_mission is not null then return v_mission; end if;

  insert into public.naxa_delivery_missions(reservation_id,pharmacie_id,client_id,ready_by)
  values(v_r.id,v_r.pharmacie_id,v_r.client_id,v_uid)
  returning id into v_mission;

  insert into public.naxa_delivery_events(
    mission_id,reservation_id,pharmacie_id,actor_id,event_type,label
  ) values(v_mission,v_r.id,v_r.pharmacie_id,v_uid,'ready','Commande préparée et disponible pour les livreurs');

  insert into public.notifications(user_id,pharmacie_id,type,titre,corps,reservation_id,related_entity_id)
  select distinct a.profile_id,v_r.pharmacie_id,'delivery_mission','Nouvelle livraison disponible',
    'Une commande préparée attend un livreur dans votre pharmacie.',v_r.id,v_mission
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id and p.actif=true
  where a.pharmacie_id=v_r.pharmacie_id and a.role_code='livreur' and a.statut='active'
    and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now());

  return v_mission;
end;
$function$;
revoke all on function public.naxa_delivery_make_available(uuid) from public,anon;
grant execute on function public.naxa_delivery_make_available(uuid) to authenticated;

create or replace function public.naxa_delivery_my_missions(p_include_history boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_pharmacy uuid;
  v_result jsonb;
begin
  if v_uid is null or public.naxa_business_function(v_uid)<>'livreur' then
    raise exception 'Espace Livreur requis';
  end if;
  select public.naxa_active_role_pharmacy(v_uid) into v_pharmacy;
  if v_pharmacy is null or not exists (
    select 1 from public.naxa_professional_assignments a
    where a.profile_id=v_uid and a.pharmacie_id=v_pharmacy and a.role_code='livreur'
      and a.statut='active' and a.commence_at<=now()
      and (a.expire_at is null or a.expire_at>now())
  ) then raise exception 'Affectation Livreur inactive'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id,'reservation_id',m.reservation_id,'statut',m.statut,
    'created_at',m.created_at,'ready_at',m.ready_at,'accepted_at',m.accepted_at,
    'picked_up_at',m.picked_up_at,'arrived_at',m.arrived_at,'delivered_at',m.delivered_at,
    'failure_code',m.failure_code,'failure_note',m.failure_note,
    'commande_statut',r.commande_statut,'total',r.total,'frais_livraison',r.frais_livraison,
    'created_order_at',r.created_at,'ville',r.ville_livraison,'quartier',r.quartier_livraison,
    'adresse',case when m.livreur_id=v_uid then r.adresse_livraison else null end,
    'repere',case when m.livreur_id=v_uid then r.repere_livraison else null end,
    'telephone',case when m.livreur_id=v_uid then r.telephone_livraison else null end,
    'items',case when m.livreur_id=v_uid then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'quantite',ri.quantite,'nom',p.nom,'dosage',p.dosage
      ) order by ri.id),'[]'::jsonb)
      from public.reservation_items ri join public.produits p on p.id=ri.produit_id
      where ri.reservation_id=r.id
    ) else '[]'::jsonb end
  ) order by case when m.statut='available' then 0 else 1 end,m.ready_at)
  , '[]'::jsonb) into v_result
  from public.naxa_delivery_missions m
  join public.reservations r on r.id=m.reservation_id
  where m.pharmacie_id=v_pharmacy
    and (
      m.statut='available'
      or m.livreur_id=v_uid
    )
    and (p_include_history or m.statut in ('available','accepted','picked_up','arrived'));
  return v_result;
end;
$function$;
revoke all on function public.naxa_delivery_my_missions(boolean) from public,anon;
grant execute on function public.naxa_delivery_my_missions(boolean) to authenticated;

create or replace function public.naxa_delivery_accept(p_mission uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
  v_pharmacy uuid;
begin
  if v_uid is null or public.naxa_business_function(v_uid)<>'livreur' then
    raise exception 'Poste Livreur actif requis';
  end if;
  v_pharmacy:=public.naxa_active_role_pharmacy(v_uid);
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if not found or v_m.statut<>'available' or v_m.pharmacie_id<>v_pharmacy then
    raise exception 'Mission déjà prise ou indisponible';
  end if;
  if not exists(select 1 from public.profiles p where p.id=v_uid and p.actif=true)
    or not exists(select 1 from public.naxa_professional_assignments a
      where a.profile_id=v_uid and a.pharmacie_id=v_pharmacy and a.role_code='livreur'
        and a.statut='active' and a.commence_at<=now()
        and (a.expire_at is null or a.expire_at>now())) then
    raise exception 'Affectation Livreur suspendue ou expirée';
  end if;

  update public.naxa_delivery_missions
  set livreur_id=v_uid,statut='accepted',accepted_at=now(),updated_at=now()
  where id=p_mission and statut='available';
  if not found then raise exception 'Cette mission vient d’être prise par un autre livreur'; end if;
  update public.reservations set commande_statut='livreur_assigne' where id=v_m.reservation_id;
  insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label)
  values(v_m.id,v_m.reservation_id,v_m.pharmacie_id,v_uid,'accepted','Livraison acceptée par un livreur');
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_accept(uuid) from public,anon;
grant execute on function public.naxa_delivery_accept(uuid) to authenticated;

create or replace function public.naxa_delivery_pickup(p_mission uuid,p_latitude double precision default null,p_longitude double precision default null,p_accuracy_m double precision default null)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
begin
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if v_uid is null or not found or v_m.livreur_id<>v_uid or v_m.statut<>'accepted' then
    raise exception 'Seul le livreur affecté peut retirer cette commande';
  end if;
  if (p_latitude is null)<>(p_longitude is null)
    or p_latitude is not null and (p_latitude not between -90 and 90 or p_longitude not between -180 and 180)
    or p_accuracy_m is not null and p_accuracy_m not between 0 and 10000 then
    raise exception 'Position GPS invalide';
  end if;
  update public.naxa_delivery_missions
  set statut='picked_up',picked_up_at=now(),updated_at=now()
  where id=p_mission;
  update public.reservations set commande_statut='en_livraison' where id=v_m.reservation_id;
  insert into public.naxa_delivery_events(
    mission_id,reservation_id,pharmacie_id,actor_id,event_type,label,latitude,longitude,accuracy_m
  ) values(p_mission,v_m.reservation_id,v_m.pharmacie_id,v_uid,'picked_up','Commande récupérée à la pharmacie',p_latitude,p_longitude,p_accuracy_m);
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_pickup(uuid,double precision,double precision,double precision) from public,anon;
grant execute on function public.naxa_delivery_pickup(uuid,double precision,double precision,double precision) to authenticated;

create or replace function public.naxa_delivery_add_location(
  p_mission uuid,p_latitude double precision,p_longitude double precision,p_accuracy_m double precision default null
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
  v_last timestamptz;
begin
  if v_uid is null or p_latitude is null or p_longitude is null
    or p_latitude not between -90 and 90 or p_longitude not between -180 and 180
    or (p_accuracy_m is not null and p_accuracy_m not between 0 and 10000) then
    raise exception 'Coordonnées de position invalides';
  end if;
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if not found or v_m.livreur_id<>v_uid or v_m.statut not in ('accepted','picked_up','arrived') then
    raise exception 'Position non autorisée pour cette mission';
  end if;
  select max(e.created_at) into v_last from public.naxa_delivery_events e
  where e.mission_id=p_mission and e.event_type='location';
  if v_last is not null and v_last>now()-interval '10 seconds' then
    raise exception 'Patientez avant de partager une nouvelle position';
  end if;
  insert into public.naxa_delivery_events(
    mission_id,reservation_id,pharmacie_id,actor_id,event_type,label,latitude,longitude,accuracy_m
  ) values(p_mission,v_m.reservation_id,v_m.pharmacie_id,v_uid,'location','Position du livreur',p_latitude,p_longitude,p_accuracy_m);
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_add_location(uuid,double precision,double precision,double precision) from public,anon;
grant execute on function public.naxa_delivery_add_location(uuid,double precision,double precision,double precision) to authenticated;

create or replace function public.naxa_delivery_arrived(p_mission uuid,p_latitude double precision default null,p_longitude double precision default null)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
begin
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if v_uid is null or not found or v_m.livreur_id<>v_uid or v_m.statut<>'picked_up' then
    raise exception 'Le livreur affecté doit avoir récupéré la commande avant de signaler son arrivée';
  end if;
  update public.naxa_delivery_missions set statut='arrived',arrived_at=now(),updated_at=now() where id=p_mission;
  insert into public.naxa_delivery_events(
    mission_id,reservation_id,pharmacie_id,actor_id,event_type,label,latitude,longitude
  ) values(p_mission,v_m.reservation_id,v_m.pharmacie_id,v_uid,'arrived','Livreur arrivé à destination',p_latitude,p_longitude);
  insert into public.notifications(user_id,pharmacie_id,type,titre,corps,reservation_id,related_entity_id)
  values(v_m.client_id,v_m.pharmacie_id,'delivery_arrived','Votre livreur est arrivé',
    'Veuillez confirmer la réception de votre commande dans NAXA.',v_m.reservation_id,v_m.id);
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_arrived(uuid,double precision,double precision) from public,anon;
grant execute on function public.naxa_delivery_arrived(uuid,double precision,double precision) to authenticated;

create or replace function public.naxa_delivery_report_issue(p_mission uuid,p_code text,p_note text default null)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
begin
  if p_code not in ('client_absent','adresse_introuvable','client_injoignable','incident_route','commande_endommagee','autre')
    or length(coalesce(p_note,''))>500 then raise exception 'Motif de difficulté invalide'; end if;
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if v_uid is null or not found or v_m.livreur_id<>v_uid or v_m.statut not in ('accepted','picked_up','arrived') then
    raise exception 'Cette mission ne peut pas recevoir de signalement';
  end if;
  update public.naxa_delivery_missions
  set statut='failed',failed_at=now(),failure_code=p_code,failure_note=nullif(trim(p_note),''),updated_at=now()
  where id=p_mission;
  insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label,detail)
  values(p_mission,v_m.reservation_id,v_m.pharmacie_id,v_uid,'failed','Incident de livraison signalé',
    jsonb_build_object('code',p_code,'note',nullif(trim(p_note),''))::text);
  insert into public.notifications(user_id,pharmacie_id,type,titre,corps,reservation_id,related_entity_id)
  values(v_m.client_id,v_m.pharmacie_id,'delivery_issue','Difficulté pendant la livraison',
    'Le livreur a signalé une difficulté. La pharmacie doit organiser la suite.',v_m.reservation_id,v_m.id);
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_report_issue(uuid,text,text) from public,anon;
grant execute on function public.naxa_delivery_report_issue(uuid,text,text) to authenticated;

-- Réouverture contrôlée avant récupération physique du colis seulement.
create or replace function public.naxa_delivery_reoffer(p_mission uuid,p_note text)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
  v_role text;
begin
  if v_uid is null or p_note is null or length(trim(p_note))<5 or length(trim(p_note))>300 then
    raise exception 'Motif de réaffectation invalide';
  end if;
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if not found then raise exception 'Mission introuvable'; end if;
  if not public.naxa_scope_allows(v_uid,v_m.pharmacie_id,'PHARMACIE') then raise exception 'Mission hors périmètre'; end if;
  v_role:=public.naxa_business_function(v_uid);
  if not public.is_admin() and v_role not in ('promoteur','pharmacie','gestionnaire_stock','magasinier','responsable') then
    raise exception 'Réaffectation réservée à la pharmacie ou au Promoteur';
  end if;
  if v_m.statut not in ('accepted','failed') or v_m.picked_up_at is not null then
    raise exception 'La mission ne peut être réouverte après le retrait du colis';
  end if;
  update public.naxa_delivery_missions
  set livreur_id=null,statut='available',accepted_at=null,failed_at=null,
      failure_code=null,failure_note=null,updated_at=now()
  where id=p_mission;
  insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label,detail)
  values(v_m.id,v_m.reservation_id,v_m.pharmacie_id,v_uid,'reoffered','Mission remise à disposition des livreurs',trim(p_note));
  insert into public.notifications(user_id,pharmacie_id,type,titre,corps,reservation_id,related_entity_id)
  select distinct a.profile_id,v_m.pharmacie_id,'delivery_mission','Livraison remise à disposition',
    'Une livraison attend un livreur.',v_m.reservation_id,v_m.id
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id and p.actif=true
  where a.pharmacie_id=v_m.pharmacie_id and a.role_code='livreur' and a.statut='active'
    and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now());
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_reoffer(uuid,text) from public,anon;
grant execute on function public.naxa_delivery_reoffer(uuid,text) to authenticated;

-- Le livreur ne clôture pas lui-même une remise : le Client confirme la réception.
create or replace function public.naxa_delivery_confirm_received(p_mission uuid,p_note text default null)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
begin
  if v_uid is null then raise exception 'Connexion Client requise'; end if;
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if not found or v_m.client_id<>v_uid or v_m.statut<>'arrived' then
    raise exception 'La livraison ne peut être confirmée que par le Client après l’arrivée du livreur';
  end if;
  if length(coalesce(p_note,''))>300 then raise exception 'Commentaire trop long'; end if;
  update public.naxa_delivery_missions set statut='delivered',delivered_at=now(),updated_at=now() where id=p_mission;
  update public.reservations set commande_statut='livree' where id=v_m.reservation_id;
  insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label,detail)
  values(v_m.id,v_m.reservation_id,v_m.pharmacie_id,v_uid,'delivered','Réception confirmée par le Client',nullif(trim(p_note),'')); 
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_confirm_received(uuid,text) from public,anon;
grant execute on function public.naxa_delivery_confirm_received(uuid,text) to authenticated;

create or replace function public.naxa_delivery_tracking(p_reservation uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select * into v_m from public.naxa_delivery_missions
  where reservation_id=p_reservation and client_id=v_uid;
  if not found then return null; end if;
  select jsonb_build_object(
    'mission_id',v_m.id,'statut',v_m.statut,'ready_at',v_m.ready_at,
    'accepted_at',v_m.accepted_at,'picked_up_at',v_m.picked_up_at,
    'arrived_at',v_m.arrived_at,'delivered_at',v_m.delivered_at,
    'failure_code',v_m.failure_code,
    'livreur',case when v_m.livreur_id is null then null else (
      select jsonb_build_object('first_name',p.first_name,'last_name',p.last_name,'username',p.username)
      from public.profiles p where p.id=v_m.livreur_id
    ) end,
    'events',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',e.id,'event_type',e.event_type,'label',e.label,'detail',e.detail,
        'latitude',e.latitude,'longitude',e.longitude,'created_at',e.created_at
      ) order by e.created_at,e.id)
      from public.naxa_delivery_events e where e.mission_id=v_m.id
    ),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;
revoke all on function public.naxa_delivery_tracking(uuid) from public,anon;
grant execute on function public.naxa_delivery_tracking(uuid) to authenticated;

create or replace function public.naxa_delivery_my_performance(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_days integer:=greatest(1,least(coalesce(p_days,30),365));
  v_result jsonb;
begin
  if v_uid is null or public.naxa_business_function(v_uid)<>'livreur' then
    raise exception 'Espace Livreur requis';
  end if;
  select jsonb_build_object(
    'period_days',v_days,
    'total',count(*),
    'available',count(*) filter(where statut='available'),
    'in_progress',count(*) filter(where statut in ('accepted','picked_up','arrived')),
    'delivered',count(*) filter(where statut='delivered'),
    'failed',count(*) filter(where statut='failed'),
    'acceptance_rate',case when count(*)=0 then 0 else round(100.0*count(*) filter(where livreur_id=v_uid)/count(*),1) end,
    'avg_accept_minutes',round(avg(extract(epoch from (accepted_at-ready_at))/60) filter(where accepted_at is not null),1),
    'avg_delivery_minutes',round(avg(extract(epoch from (delivered_at-accepted_at))/60) filter(where delivered_at is not null),1)
  ) into v_result
  from public.naxa_delivery_missions
  where (livreur_id=v_uid or exists(
    select 1 from public.naxa_professional_assignments a
    where a.profile_id=v_uid and a.pharmacie_id=naxa_delivery_missions.pharmacie_id
      and a.role_code='livreur' and a.statut='active'
  ))
  and created_at>=now()-make_interval(days=>v_days);
  return v_result;
end;
$function$;
revoke all on function public.naxa_delivery_my_performance(integer) from public,anon;
grant execute on function public.naxa_delivery_my_performance(integer) to authenticated;

-- Alerter le Client à chaque jalon non-positionnel de son parcours.
create or replace function private.naxa_delivery_client_notification()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_title text;
  v_body text;
  v_client uuid;
begin
  if new.event_type in ('location','ready','reoffered') then return new; end if;
  select m.client_id into v_client from public.naxa_delivery_missions m where m.id=new.mission_id;
  v_title:=case new.event_type
    when 'accepted' then 'Livreur attribué'
    when 'picked_up' then 'Commande récupérée'
    when 'arrived' then 'Votre livreur est arrivé'
    when 'delivered' then 'Livraison confirmée'
    when 'failed' then 'Difficulté de livraison'
    when 'cancelled' then 'Livraison annulée'
    else 'Suivi de livraison mis à jour' end;
  v_body:=new.label;
  insert into public.notifications(user_id,pharmacie_id,type,titre,corps,reservation_id,related_entity_id)
  values(v_client,new.pharmacie_id,'delivery_update',v_title,v_body,new.reservation_id,new.mission_id);
  return new;
end;
$function$;
drop trigger if exists naxa_delivery_client_notification_trg on public.naxa_delivery_events;
create trigger naxa_delivery_client_notification_trg
after insert on public.naxa_delivery_events
for each row execute function private.naxa_delivery_client_notification();

-- Interdire à l'ancien RPC pharmacie de simuler les étapes réellement exécutées par un Livreur.
create or replace function public.mettre_a_jour_commande_client(
  p_id uuid,p_statut text,p_paiement_confirme boolean default false
) returns boolean
language plpgsql security definer set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_r public.reservations%rowtype;
  v_allowed boolean:=false;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if p_statut in ('livreur_assigne','en_livraison','livree') then
    raise exception 'Cette étape doit être exécutée par le workflow Livreur sécurisé';
  end if;
  select * into v_r from public.reservations where id=p_id for update;
  if not found or v_r.mode<>'commande' then raise exception 'Commande introuvable'; end if;
  if not (public.is_admin() or public.naxa_scope_allows(v_user,v_r.pharmacie_id,'PHARMACIE')) then
    raise exception 'Action non autorisée';
  end if;
  if p_paiement_confirme then
    if not exists(
      select 1 from public.ventes v join public.vente_paiements vp on vp.vente_id=v.id
      where v.reservation_id=v_r.id and v.pharmacie_id=v_r.pharmacie_id
        and v.statut='payee' and v.total_net=v_r.total and vp.montant=v_r.total
    ) then
      raise exception 'Paiement non confirmé : encaissez la commande via une transaction POS liée avant de confirmer son paiement';
    end if;
  end if;
  v_allowed:=case
    when v_r.commande_statut='en_attente_pharmacie' then p_statut in ('acceptee','annulee')
    when v_r.commande_statut='acceptee' then p_statut in ('preparation','annulee')
    when v_r.commande_statut='preparation' then p_statut='annulee'
    when v_r.commande_statut='livreur_assigne' then p_statut='annulee'
    else false end;
  if not v_allowed and p_statut is distinct from v_r.commande_statut then
    raise exception 'Transition de commande interdite';
  end if;
  if p_statut='annulee' and v_r.statut not in ('annulee','expiree','retiree') then
    perform private.set_reservation_status(p_id,'annulee'::public.resa_statut);
  end if;
  if p_paiement_confirme and v_r.statut not in ('payee','retiree') then
    perform private.set_reservation_status(p_id,'payee'::public.resa_statut);
  end if;
  update public.reservations
  set commande_statut=p_statut,
      expires_at=case
        when p_statut in ('acceptee','preparation') and not p_paiement_confirme
          and v_r.paiement_statut<>'effectue'
        then now()+interval '100 years' else expires_at end
  where id=p_id;
  return true;
end;
$function$;
revoke all on function public.mettre_a_jour_commande_client(uuid,text,boolean) from public,anon;
grant execute on function public.mettre_a_jour_commande_client(uuid,text,boolean) to authenticated;

commit;
