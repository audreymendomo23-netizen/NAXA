begin;

alter table public.pharmacies
  add column if not exists livraison_active boolean not null default false,
  add column if not exists rayon_livraison_km numeric(6,2) not null default 10,
  add column if not exists region text;

alter table public.pharmacies
  drop constraint if exists pharmacies_rayon_livraison_km_check;
alter table public.pharmacies
  add constraint pharmacies_rayon_livraison_km_check
  check (rayon_livraison_km between 1 and 50);

alter table public.reservations
  add column if not exists distance_livraison_km numeric(7,2),
  add column if not exists livraison_demande_at timestamptz,
  add column if not exists livraison_confirmee_stock_at timestamptz,
  add column if not exists livraison_paiement_demande_at timestamptz,
  add column if not exists livraison_depart_at timestamptz;

alter table public.naxa_delivery_missions
  add column if not exists client_confirme_at timestamptz,
  add column if not exists livreur_confirme_at timestamptz,
  add column if not exists signature_client_traces jsonb;

create table if not exists public.naxa_delivery_commission_ledger (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null unique references public.naxa_delivery_missions(id) on delete restrict,
  reservation_id uuid not null unique references public.reservations(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  promoteur_id uuid references auth.users(id) on delete restrict,
  region text,
  ville text,
  delivered_at timestamptz not null,
  settlement_month date not null,
  frais_livraison_client integer not null check (frais_livraison_client between 1500 and 3500),
  commission_naxa integer not null default 500 check (commission_naxa = 500),
  solde_livraison integer not null check (solde_livraison >= 1000),
  regle_le timestamptz,
  reference_reglement text,
  created_at timestamptz not null default now(),
  constraint naxa_delivery_commission_balance_ck
    check (frais_livraison_client = commission_naxa + solde_livraison)
);

create index if not exists naxa_delivery_commission_month_idx
  on public.naxa_delivery_commission_ledger(settlement_month, pharmacie_id);
create index if not exists naxa_delivery_commission_region_idx
  on public.naxa_delivery_commission_ledger(region, delivered_at desc);

alter table public.naxa_delivery_commission_ledger enable row level security;
revoke all on public.naxa_delivery_commission_ledger from public, anon, authenticated;
grant all on public.naxa_delivery_commission_ledger to service_role;

create or replace function public.naxa_set_pharmacy_delivery_config(
  p_pharmacie uuid,
  p_active boolean,
  p_rayon_km numeric default 10
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_role text;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if p_pharmacie is null or p_active is null
    or p_rayon_km is null or p_rayon_km not between 1 and 50 then
    raise exception 'Configuration de livraison invalide';
  end if;

  select public.naxa_business_function(v_uid) into v_role;
  if not public.is_admin() then
    if v_role='promoteur' then
      if not private.naxa_promoteur_valide(v_uid)
        or not exists(
          select 1 from public.promoteur_pharmacies pp
          where pp.promoteur_id=v_uid and pp.pharmacie_id=p_pharmacie and pp.actif
        ) then
        raise exception 'Pharmacie hors du réseau Promoteur';
      end if;
    elsif v_role='pharmacie' then
      if public.naxa_active_role_pharmacy(v_uid) is distinct from p_pharmacie
        or not public.naxa_scope_allows(v_uid,p_pharmacie,'PHARMACIE') then
        raise exception 'Configuration hors périmètre pharmacie';
      end if;
    else
      raise exception 'Configuration réservée au Promoteur, à la Pharmacie ou à l’Admin';
    end if;
  end if;

  if p_active and not exists(
    select 1 from public.pharmacies ph
    where ph.id=p_pharmacie and ph.actif=true and ph.archivee_le is null
      and ph.lat between -90 and 90 and ph.lng between -180 and 180
  ) then
    raise exception 'La pharmacie doit être active et disposer de coordonnées GPS valides';
  end if;

  update public.pharmacies
  set livraison_active=p_active,rayon_livraison_km=p_rayon_km
  where id=p_pharmacie;
  if not found then raise exception 'Pharmacie introuvable'; end if;
  return true;
end;
$function$;
revoke all on function public.naxa_set_pharmacy_delivery_config(uuid,boolean,numeric) from public,anon;
grant execute on function public.naxa_set_pharmacy_delivery_config(uuid,boolean,numeric) to authenticated;

create or replace function public.creer_transactions_client(
  p_pharmacie uuid,
  p_items jsonb,
  p_paiement_mode text,
  p_adresse jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_mode text;
  v_items jsonb;
  v_id uuid;
  v_expire timestamptz;
  v_result jsonb:='[]'::jsonb;
  v_anonyme boolean:=true;
  v_adresse jsonb:=coalesce(p_adresse,'{}'::jsonb);
  v_ville text;
  v_quartier text;
  v_rue text;
  v_telephone text;
  v_pharmacie public.pharmacies%rowtype;
  v_lat double precision;
  v_lng double precision;
  v_a double precision;
  v_distance_direct double precision;
  v_distance_km numeric(7,2);
  v_distance_entree numeric;
  v_frais integer;
  v_has_reservation boolean;
  v_has_commande boolean;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user and p.role='client' and p.actif) then
    raise exception 'Compte client requis';
  end if;

  select * into v_pharmacie from public.pharmacies p
  where p.id=p_pharmacie and p.actif and p.visible_recherche and p.archivee_le is null;
  if not found then raise exception 'Pharmacie indisponible'; end if;

  if p_items is null or jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>10 then
    raise exception 'Panier invalide';
  end if;
  if exists(
    select 1 from jsonb_array_elements(p_items) x
    where coalesce(x->>'mode','') not in ('reservation','commande')
      or coalesce((x->>'quantite')::int,0) not between 1 and 10
      or coalesce(x->>'produit_id','') !~* '^[0-9a-f-]{36}$'
  ) then raise exception 'Article ou quantité invalide'; end if;
  if exists(
    select 1 from (
      select x->>'produit_id' pid,count(*) n
      from jsonb_array_elements(p_items) x
      group by x->>'produit_id' having count(*)>1
    ) d
  ) then raise exception 'Chaque médicament doit apparaître une seule fois dans le panier'; end if;

  select
    coalesce(bool_or(x->>'mode'='reservation'),false),
    coalesce(bool_or(x->>'mode'='commande'),false)
  into v_has_reservation,v_has_commande
  from jsonb_array_elements(p_items) x;

  if v_has_reservation and v_has_commande then
    raise exception 'Séparez les réservations et les demandes de livraison en deux transactions';
  end if;
  if p_paiement_mode is not null
    and p_paiement_mode not in ('mtn_marchand','orange_money','especes_retrait','especes_livraison','a_convenir') then
    raise exception 'Mode de paiement invalide';
  end if;
  if v_has_reservation and p_paiement_mode is null then
    raise exception 'Choisissez un mode de paiement pour la réservation';
  end if;
  if v_has_commande and p_paiement_mode is not null then
    raise exception 'Le paiement sera choisi après confirmation de la demande de livraison par la pharmacie';
  end if;

  if v_has_commande then
    if v_pharmacie.livraison_active is distinct from true then
      raise exception 'Cette pharmacie ne propose pas actuellement la livraison';
    end if;
    v_ville:=left(trim(coalesce(v_adresse->>'ville','')),80);
    v_quartier:=left(trim(coalesce(v_adresse->>'quartier','')),80);
    v_rue:=left(trim(coalesce(v_adresse->>'rue','')),200);
    v_telephone:=left(trim(coalesce(v_adresse->>'telephone','')),30);
    if v_ville='' or v_quartier='' or v_rue='' or length(v_telephone)<6 then
      raise exception 'Adresse de livraison et téléphone obligatoires pour une commande';
    end if;
    if coalesce(v_adresse->>'latitude','') !~ '^-?[0-9]+(\.[0-9]+)?$'
      or coalesce(v_adresse->>'longitude','') !~ '^-?[0-9]+(\.[0-9]+)?$' then
      raise exception 'Position GPS requise pour calculer les frais de livraison';
    end if;
    v_lat:=(v_adresse->>'latitude')::double precision;
    v_lng:=(v_adresse->>'longitude')::double precision;
    if v_lat not between -90 and 90 or v_lng not between -180 and 180
      or v_pharmacie.lat not between -90 and 90 or v_pharmacie.lng not between -180 and 180 then
      raise exception 'Coordonnées GPS invalides';
    end if;

    v_a:=power(sin(radians(v_lat-v_pharmacie.lat)/2),2)
      +cos(radians(v_pharmacie.lat))*cos(radians(v_lat))
      *power(sin(radians(v_lng-v_pharmacie.lng)/2),2);
    v_distance_direct:=6371*2*asin(least(1,sqrt(greatest(0,v_a))));
    v_distance_entree:=null;
    if coalesce(v_adresse->>'distance_km','') ~ '^[0-9]+(\.[0-9]{1,3})?$' then
      v_distance_entree:=(v_adresse->>'distance_km')::numeric;
    end if;
    v_distance_km:=round(coalesce(v_distance_entree,v_distance_direct*1.4)::numeric,2);
    if v_distance_km < round(v_distance_direct::numeric,2)
      or v_distance_km > greatest(1.5,v_distance_direct*4) then
      raise exception 'Distance routière incohérente avec les coordonnées GPS';
    end if;
    if v_distance_km>v_pharmacie.rayon_livraison_km then
      raise exception 'Adresse hors du rayon de livraison de cette pharmacie';
    end if;
    v_frais:=greatest(1500,least(3500,round(1500+(v_distance_km*200))::integer));
  else
    if p_paiement_mode='especes_livraison' then
      raise exception 'Les espèces à la livraison ne conviennent pas à une réservation';
    end if;
    v_frais:=0;
    v_distance_km:=null;
  end if;

  if not exists(select 1 from public.client_preferences p where p.user_id=v_user) then
    insert into public.client_preferences(user_id) values(v_user) on conflict(user_id) do nothing;
  end if;
  select coalesce(p.anonyme_defaut,true) into v_anonyme
  from public.client_preferences p where p.user_id=v_user;

  for v_mode in
    select distinct x->>'mode' from jsonb_array_elements(p_items) x order by 1
  loop
    select jsonb_agg(
      jsonb_build_object('produit_id',x->>'produit_id','quantite',(x->>'quantite')::int)
      order by x->>'produit_id'
    ) into v_items
    from jsonb_array_elements(p_items) x where x->>'mode'=v_mode;

    v_id:=private.reserve_stock(p_pharmacie,v_items);
    v_expire:=now()+case when v_mode='reservation' then interval '4 hours' else interval '24 hours' end;

    update public.reservations set
      mode=v_mode,
      paiement_statut='a_verifier',
      paiement_mode=case when v_mode='commande' then null else p_paiement_mode end,
      commande_statut=case when v_mode='commande' then 'en_attente_pharmacie' else null end,
      expires_at=v_expire,
      adresse_livraison=case when v_mode='commande' then v_rue else null end,
      quartier_livraison=case when v_mode='commande' then v_quartier else null end,
      ville_livraison=case when v_mode='commande' then v_ville else null end,
      repere_livraison=case when v_mode='commande' then left(trim(coalesce(v_adresse->>'repere','')),200) else null end,
      telephone_livraison=case when v_mode='commande' then v_telephone else null end,
      latitude_livraison=case when v_mode='commande' then v_lat else null end,
      longitude_livraison=case when v_mode='commande' then v_lng else null end,
      frais_livraison=case when v_mode='commande' then v_frais else 0 end,
      distance_livraison_km=case when v_mode='commande' then v_distance_km else null end,
      livraison_demande_at=case when v_mode='commande' then now() else null end
    where id=v_id and client_id=v_user;

    insert into public.fils_messages(pharmacie_id,client_id,anonyme)
      values(p_pharmacie,v_user,v_anonyme) on conflict(client_id,pharmacie_id) do nothing;

    insert into public.notifications(pharmacie_id,type,titre,corps,fil_id,reservation_id)
    values(
      p_pharmacie,
      v_mode,
      case when v_mode='reservation' then 'Nouvelle réservation' else 'Nouvelle demande de livraison' end,
      case when v_mode='reservation'
        then 'Une réservation attend votre confirmation.'
        else 'Un client demande une livraison. Le Gestionnaire de stock doit confirmer la prise en charge avant le paiement.'
      end,
      (select f.id from public.fils_messages f where f.client_id=v_user and f.pharmacie_id=p_pharmacie),
      v_id
    );

    v_result:=v_result||jsonb_build_array(jsonb_build_object(
      'id',v_id,'mode',v_mode,'expires_at',v_expire,
      'frais_livraison',case when v_mode='commande' then v_frais else 0 end,
      'distance_livraison_km',case when v_mode='commande' then v_distance_km else null end
    ));
  end loop;
  return v_result;
end;
$function$;

-- The client and the courier must both validate receipt. A handwritten signature
-- on the courier device is the explicit fallback when the client device is unavailable.
create or replace function private.naxa_delivery_finalize_if_confirmed(p_mission uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_m public.naxa_delivery_missions%rowtype;
  v_r public.reservations%rowtype;
  v_region text;
  v_ville text;
  v_promoteur uuid;
begin
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if not found or v_m.statut='delivered' then return found; end if;
  if v_m.statut<>'arrived' or v_m.client_confirme_at is null or v_m.livreur_confirme_at is null then
    return false;
  end if;

  select * into v_r from public.reservations where id=v_m.reservation_id for update;
  select ph.region,ph.ville into v_region,v_ville
  from public.pharmacies ph where ph.id=v_m.pharmacie_id;
  select pp.promoteur_id into v_promoteur
  from public.promoteur_pharmacies pp
  where pp.pharmacie_id=v_m.pharmacie_id and pp.actif
  order by pp.created_at asc limit 1;

  update public.naxa_delivery_missions
  set statut='delivered',delivered_at=coalesce(delivered_at,now()),updated_at=now()
  where id=p_mission;
  update public.naxa_delivery_mission_offers
  set offer_status='delivered',delivered_at=coalesce(delivered_at,now())
  where mission_id=p_mission and livreur_id=v_m.livreur_id and offer_status='accepted';
  update public.reservations set commande_statut='livree' where id=v_m.reservation_id;

  insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label)
  values(v_m.id,v_m.reservation_id,v_m.pharmacie_id,v_m.livreur_id,'delivered','Réception confirmée par le Client et le Livreur')
  on conflict do nothing;

  if v_r.frais_livraison between 1500 and 3500 then
    insert into public.naxa_delivery_commission_ledger(
      mission_id,reservation_id,pharmacie_id,promoteur_id,region,ville,delivered_at,
      settlement_month,frais_livraison_client,commission_naxa,solde_livraison
    ) values(
      v_m.id,v_r.id,v_m.pharmacie_id,v_promoteur,v_region,v_ville,
      coalesce(v_m.delivered_at,now()),
      date_trunc('month',coalesce(v_m.delivered_at,now()))::date,
      v_r.frais_livraison,500,v_r.frais_livraison-500
    ) on conflict(mission_id) do nothing;
  end if;
  return true;
end;
$function$;
revoke all on function private.naxa_delivery_finalize_if_confirmed(uuid) from public,anon,authenticated;

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
  update public.naxa_delivery_missions
  set client_confirme_at=coalesce(client_confirme_at,now()),updated_at=now()
  where id=p_mission;
  insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label,detail)
  values(v_m.id,v_m.reservation_id,v_m.pharmacie_id,v_uid,'client_confirmed','Réception confirmée dans l’application Client',nullif(trim(p_note),''));
  perform private.naxa_delivery_finalize_if_confirmed(p_mission);
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_confirm_received(uuid,text) from public,anon;
grant execute on function public.naxa_delivery_confirm_received(uuid,text) to authenticated;

create or replace function public.naxa_delivery_confirm_handover(p_mission uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
begin
  if v_uid is null then raise exception 'Connexion Livreur requise'; end if;
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if not found or v_m.livreur_id is distinct from v_uid or v_m.statut<>'arrived'
    or public.naxa_business_function(v_uid)<>'livreur' then
    raise exception 'Seul le Livreur affecté peut confirmer la remise';
  end if;
  update public.naxa_delivery_missions
  set livreur_confirme_at=coalesce(livreur_confirme_at,now()),updated_at=now()
  where id=p_mission;
  insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label)
  values(v_m.id,v_m.reservation_id,v_m.pharmacie_id,v_uid,'courier_confirmed','Remise confirmée par le Livreur');
  perform private.naxa_delivery_finalize_if_confirmed(p_mission);
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_confirm_handover(uuid) from public,anon;
grant execute on function public.naxa_delivery_confirm_handover(uuid) to authenticated;

create or replace function public.naxa_delivery_confirm_signature(
  p_mission uuid,
  p_strokes jsonb
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
  v_stroke jsonb;
  v_point jsonb;
  v_strokes_count integer;
  v_points_count integer:=0;
begin
  if v_uid is null or jsonb_typeof(p_strokes) is distinct from 'array'
    or jsonb_array_length(p_strokes)<1 or jsonb_array_length(p_strokes)>30
    or pg_column_size(p_strokes)>65536 then
    raise exception 'Signature client invalide ou trop volumineuse';
  end if;
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if not found or v_m.livreur_id is distinct from v_uid or v_m.statut<>'arrived'
    or public.naxa_business_function(v_uid)<>'livreur' then
    raise exception 'Seul le Livreur affecté peut recueillir la signature du Client';
  end if;
  for v_stroke in select value from jsonb_array_elements(p_strokes) loop
    if jsonb_typeof(v_stroke) is distinct from 'array'
      or jsonb_array_length(v_stroke)<1 or jsonb_array_length(v_stroke)>250 then
      raise exception 'Tracé de signature invalide';
    end if;
    for v_point in select value from jsonb_array_elements(v_stroke) loop
      if jsonb_typeof(v_point) is distinct from 'object'
        or not (v_point ? 'x') or not (v_point ? 'y')
        or coalesce(v_point->>'x','') !~ '^(0(\.[0-9]{1,4})?|1(\.0{1,4})?)$'
        or coalesce(v_point->>'y','') !~ '^(0(\.[0-9]{1,4})?|1(\.0{1,4})?)$' then
        raise exception 'Coordonnée de signature invalide';
      end if;
      v_points_count:=v_points_count+1;
      if v_points_count>2500 then raise exception 'Signature trop détaillée'; end if;
    end loop;
  end loop;

  update public.naxa_delivery_missions
  set signature_client_traces=p_strokes,
      client_confirme_at=coalesce(client_confirme_at,now()),
      livreur_confirme_at=coalesce(livreur_confirme_at,now()),
      updated_at=now()
  where id=p_mission;
  insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label)
  values(v_m.id,v_m.reservation_id,v_m.pharmacie_id,v_uid,'client_signature','Signature du Client recueillie sur le téléphone du Livreur');
  perform private.naxa_delivery_finalize_if_confirmed(p_mission);
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_confirm_signature(uuid,jsonb) from public,anon;
grant execute on function public.naxa_delivery_confirm_signature(uuid,jsonb) to authenticated;

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
    'client_confirme_at',v_m.client_confirme_at,
    'livreur_confirme_at',v_m.livreur_confirme_at,
    'signature_client',v_m.signature_client_traces is not null,
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

create or replace function public.naxa_delivery_commission_report(
  p_from date default date_trunc('month',current_date)::date,
  p_to date default current_date,
  p_pharmacie uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_scope text;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then
    raise exception 'Période de rapport invalide';
  end if;
  v_role:=public.naxa_business_function(v_uid);
  if not public.is_admin() and v_role not in ('promoteur','pharmacie') then
    raise exception 'Rapport réservé à l’Administration, au Promoteur et à la Pharmacie';
  end if;

  if v_role='pharmacie' and p_pharmacie is not null
    and public.naxa_active_role_pharmacy(v_uid) is distinct from p_pharmacie then
    raise exception 'Pharmacie hors périmètre';
  end if;
  if v_role='promoteur' and p_pharmacie is not null and not exists(
    select 1 from public.promoteur_pharmacies pp
    where pp.promoteur_id=v_uid and pp.pharmacie_id=p_pharmacie and pp.actif
  ) then raise exception 'Pharmacie hors réseau Promoteur'; end if;

  with scoped as (
    select l.*,ph.nom,ph.ville,coalesce(l.region,ph.region,ph.ville,'Non renseignée') as region_label
    from public.naxa_delivery_commission_ledger l
    join public.pharmacies ph on ph.id=l.pharmacie_id
    where l.delivered_at>=p_from::timestamptz
      and l.delivered_at<(p_to+1)::timestamptz
      and (p_pharmacie is null or l.pharmacie_id=p_pharmacie)
      and (
        public.is_admin()
        or (v_role='pharmacie' and public.naxa_active_role_pharmacy(v_uid)=l.pharmacie_id)
        or (v_role='promoteur' and exists(
          select 1 from public.promoteur_pharmacies pp
          where pp.promoteur_id=v_uid and pp.pharmacie_id=l.pharmacie_id and pp.actif
        ))
      )
  ),
  by_pharmacy as (
    select pharmacie_id,nom,ville,region_label,
      count(*)::integer as livraisons,
      sum(frais_livraison_client)::integer as frais_clients,
      sum(commission_naxa)::integer as commission_acquise,
      sum(solde_livraison)::integer as solde_livraison,
      sum(case when regle_le is not null then commission_naxa else 0 end)::integer as commission_reglee,
      sum(case when regle_le is null then commission_naxa else 0 end)::integer as commission_a_regler
    from scoped group by pharmacie_id,nom,ville,region_label
  ),
  by_region as (
    select region_label,count(*)::integer as livraisons,
      sum(commission_naxa)::integer as commission_acquise
    from scoped group by region_label
  )
  select jsonb_build_object(
    'periode_du',p_from,'periode_au',p_to,
    'totaux',jsonb_build_object(
      'livraisons',coalesce((select sum(livraisons) from by_pharmacy),0),
      'frais_clients',coalesce((select sum(frais_clients) from by_pharmacy),0),
      'commission_acquise',coalesce((select sum(commission_acquise) from by_pharmacy),0),
      'commission_reglee',coalesce((select sum(commission_reglee) from by_pharmacy),0),
      'commission_a_regler',coalesce((select sum(commission_a_regler) from by_pharmacy),0),
      'solde_livraison',coalesce((select sum(solde_livraison) from by_pharmacy),0)
    ),
    'par_pharmacie',coalesce((select jsonb_agg(to_jsonb(x) order by x.commission_acquise desc) from by_pharmacy x),'[]'::jsonb),
    'par_region',coalesce((select jsonb_agg(to_jsonb(x) order by x.commission_acquise desc) from by_region x),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;
revoke all on function public.naxa_delivery_commission_report(date,date,uuid) from public,anon;
grant execute on function public.naxa_delivery_commission_report(date,date,uuid) to authenticated;

commit;
