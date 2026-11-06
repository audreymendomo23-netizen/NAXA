-- NAXA — gestion des offres, réaffectation, annulation sans mission orpheline et KPI corrects.
begin;

alter table public.naxa_delivery_missions
  drop constraint if exists naxa_delivery_mission_driver_ck;
alter table public.naxa_delivery_missions
  add constraint naxa_delivery_mission_driver_ck check (
    (statut='available' and livreur_id is null)
    or (statut='cancelled')
    or (statut not in ('available','cancelled') and livreur_id is not null)
  );

create table if not exists public.naxa_delivery_mission_offers (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.naxa_delivery_missions(id) on delete restrict,
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  livreur_id uuid not null references public.profiles(id) on delete restrict,
  offer_status text not null default 'offered'
    check (offer_status in ('offered','accepted','lost','recalled','failed','delivered')),
  offered_at timestamptz not null default now(),
  accepted_at timestamptz,
  delivered_at timestamptz
);
create index if not exists naxa_delivery_offers_driver_time_idx
  on public.naxa_delivery_mission_offers(livreur_id,offered_at desc);
create index if not exists naxa_delivery_offers_mission_status_idx
  on public.naxa_delivery_mission_offers(mission_id,offer_status);
alter table public.naxa_delivery_mission_offers enable row level security;
revoke all on public.naxa_delivery_mission_offers from public,anon,authenticated;
grant all on public.naxa_delivery_mission_offers to service_role;
comment on table public.naxa_delivery_mission_offers is
  'Offres de mission individuelles envoyées aux livreurs actifs ; base des taux d’acceptation personnels.';

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
  v_m public.naxa_delivery_missions%rowtype;
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
  if v_r.commande_statut<>'preparation' or v_r.statut in ('annulee','expiree','retiree') then
    raise exception 'La commande doit être active et en préparation avant publication';
  end if;

  select * into v_m from public.naxa_delivery_missions where reservation_id=p_reservation for update;
  if found then
    if v_m.statut='cancelled' then raise exception 'Cette commande a été annulée et ne peut plus être republiée'; end if;
    if v_m.statut='failed' then raise exception 'Cette mission doit être réaffectée par la pharmacie avant toute nouvelle publication'; end if;
    return v_m.id;
  end if;

  insert into public.naxa_delivery_missions(reservation_id,pharmacie_id,client_id,ready_by)
  values(v_r.id,v_r.pharmacie_id,v_r.client_id,v_uid)
  returning id into v_mission;

  insert into public.naxa_delivery_events(
    mission_id,reservation_id,pharmacie_id,actor_id,event_type,label
  ) values(v_mission,v_r.id,v_r.pharmacie_id,v_uid,'ready','Commande préparée et disponible pour les livreurs');

  insert into public.naxa_delivery_mission_offers(mission_id,reservation_id,pharmacie_id,livreur_id)
  select v_mission,v_r.id,v_r.pharmacie_id,a.profile_id
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id and p.actif=true
  where a.pharmacie_id=v_r.pharmacie_id and a.role_code='livreur' and a.statut='active'
    and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now());

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
  v_offer uuid;
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

  insert into public.naxa_delivery_mission_offers(mission_id,reservation_id,pharmacie_id,livreur_id)
  select v_m.id,v_m.reservation_id,v_m.pharmacie_id,v_uid
  where not exists(select 1 from public.naxa_delivery_mission_offers o
    where o.mission_id=v_m.id and o.livreur_id=v_uid and o.offer_status='offered')
  returning id into v_offer;

  update public.naxa_delivery_missions
  set livreur_id=v_uid,statut='accepted',accepted_at=now(),updated_at=now()
  where id=p_mission and statut='available';
  if not found then raise exception 'Cette mission vient d’être prise par un autre livreur'; end if;

  update public.naxa_delivery_mission_offers
  set offer_status=case when livreur_id=v_uid then 'accepted' else 'lost' end,
      accepted_at=case when livreur_id=v_uid then now() else accepted_at end
  where mission_id=v_m.id and offer_status='offered';

  update public.reservations set commande_statut='livreur_assigne' where id=v_m.reservation_id;
  insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label)
  values(v_m.id,v_m.reservation_id,v_m.pharmacie_id,v_uid,'accepted','Livraison acceptée par un livreur');
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_accept(uuid) from public,anon;
grant execute on function public.naxa_delivery_accept(uuid) to authenticated;

create or replace function public.naxa_delivery_report_issue(p_mission uuid,p_code text,p_note text default null)
returns boolean
language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
begin
  if p_code not in ('client_absent','adresse_introuvable','client_injoignable','incident_route','commande_endommagee','autre')
    or length(coalesce(p_note,''))>500 then raise exception 'Motif de difficulté invalide'; end if;
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if v_uid is null or not found or not private.naxa_delivery_driver_can_act(v_uid,p_mission)
    or v_m.statut not in ('accepted','picked_up','arrived') then
    raise exception 'Cette mission ne peut pas recevoir de signalement';
  end if;
  update public.naxa_delivery_missions
  set statut='failed',failed_at=now(),failure_code=p_code,failure_note=nullif(trim(p_note),''),updated_at=now()
  where id=p_mission;
  update public.naxa_delivery_mission_offers
  set offer_status='failed'
  where mission_id=p_mission and livreur_id=v_uid and offer_status='accepted';
  insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label,detail)
  values(p_mission,v_m.reservation_id,v_m.pharmacie_id,v_uid,'failed','Incident de livraison signalé',
    jsonb_build_object('code',p_code,'note',nullif(trim(p_note),''))::text);
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_report_issue(uuid,text,text) from public,anon;
grant execute on function public.naxa_delivery_report_issue(uuid,text,text) to authenticated;

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
    raise exception 'La mission ne peut pas être réouverte après le retrait du colis';
  end if;

  update public.naxa_delivery_missions
  set livreur_id=null,statut='available',accepted_at=null,failed_at=null,
      failure_code=null,failure_note=null,updated_at=now()
  where id=p_mission;
  update public.reservations set commande_statut='preparation' where id=v_m.reservation_id;
  insert into public.naxa_delivery_mission_offers(mission_id,reservation_id,pharmacie_id,livreur_id)
  select v_m.id,v_m.reservation_id,v_m.pharmacie_id,a.profile_id
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id and p.actif=true
  where a.pharmacie_id=v_m.pharmacie_id and a.role_code='livreur' and a.statut='active'
    and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now());

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
  update public.naxa_delivery_mission_offers
  set offer_status='delivered',delivered_at=now()
  where mission_id=p_mission and livreur_id=v_m.livreur_id and offer_status='accepted';
  update public.reservations set commande_statut='livree' where id=v_m.reservation_id;
  insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label,detail)
  values(v_m.id,v_m.reservation_id,v_m.pharmacie_id,v_uid,'delivered','Réception confirmée par le Client',nullif(trim(p_note),'')); 
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_confirm_received(uuid,text) from public,anon;
grant execute on function public.naxa_delivery_confirm_received(uuid,text) to authenticated;

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
    'total',count(o.id),
    'available',count(o.id) filter(where o.offer_status='offered'),
    'in_progress',count(o.id) filter(where o.offer_status='accepted'),
    'delivered',count(o.id) filter(where o.offer_status='delivered'),
    'failed',count(o.id) filter(where o.offer_status='failed'),
    'acceptance_rate',case when count(o.id)=0 then 0
      else round(100.0*count(o.id) filter(where o.offer_status in ('accepted','delivered','failed'))/count(o.id),1) end,
    'avg_accept_minutes',round(avg(extract(epoch from (o.accepted_at-o.offered_at))/60)
      filter(where o.accepted_at is not null),1),
    'avg_delivery_minutes',round(avg(extract(epoch from (o.delivered_at-o.accepted_at))/60)
      filter(where o.delivered_at is not null),1)
  ) into v_result
  from public.naxa_delivery_mission_offers o
  where o.livreur_id=v_uid and o.offered_at>=now()-make_interval(days=>v_days);
  return v_result;
end;
$function$;
revoke all on function public.naxa_delivery_my_performance(integer) from public,anon;
grant execute on function public.naxa_delivery_my_performance(integer) to authenticated;

-- Cancellation is blocked once a courier has accepted or physically collected the parcel.
create or replace function public.mettre_a_jour_commande_client(
  p_id uuid,p_statut text,p_paiement_confirme boolean default false
) returns boolean
language plpgsql security definer set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_r public.reservations%rowtype;
  v_m public.naxa_delivery_missions%rowtype;
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
    else false end;
  if not v_allowed and p_statut is distinct from v_r.commande_statut then
    raise exception 'Transition de commande interdite';
  end if;

  if p_statut='annulee' then
    select * into v_m from public.naxa_delivery_missions where reservation_id=p_id for update;
    if found then
      if v_m.statut in ('accepted','picked_up','arrived','delivered') then
        raise exception 'Un livreur a déjà accepté cette commande. La pharmacie doit traiter la mission avec le réseau de livraison avant toute annulation.';
      end if;
      if v_m.statut='available' or v_m.statut='failed' then
        update public.naxa_delivery_missions set statut='cancelled',updated_at=now() where id=v_m.id;
        update public.naxa_delivery_mission_offers
        set offer_status='recalled'
        where mission_id=v_m.id and offer_status='offered';
        insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label)
        values(v_m.id,v_m.reservation_id,v_m.pharmacie_id,v_user,'cancelled','Commande annulée par la pharmacie');
      end if;
    end if;
    if v_r.statut not in ('annulee','expiree','retiree') then
      perform private.set_reservation_status(p_id,'annulee'::public.resa_statut);
    end if;
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
