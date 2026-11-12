begin;

alter table public.ventes
  add column if not exists frais_livraison integer not null default 0;
alter table public.ventes
  drop constraint if exists ventes_frais_livraison_check;
alter table public.ventes
  add constraint ventes_frais_livraison_check check (frais_livraison>=0);

create table if not exists public.naxa_delivery_payment_records (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.reservations(id) on delete restrict,
  mission_id uuid unique references public.naxa_delivery_missions(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  client_id uuid not null references auth.users(id) on delete restrict,
  livreur_id uuid references auth.users(id) on delete set null,
  mode text not null check(mode in ('mtn_marchand','orange_money','especes_livraison')),
  expected_amount integer not null check(expected_amount>0),
  reference text,
  cash_received integer check(cash_received is null or cash_received>0),
  cash_change integer not null default 0 check(cash_change>=0),
  status text not null default 'declared'
    check(status in ('declared','cash_declared','paid','rejected')),
  declared_by uuid references auth.users(id) on delete set null,
  declared_at timestamptz not null default now(),
  validated_by uuid references auth.users(id) on delete set null,
  validated_at timestamptz,
  caisse_session_id uuid references public.caisses_sessions(id) on delete restrict,
  vente_id uuid unique references public.ventes(id) on delete restrict,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reference is null or length(reference)<=120),
  check (rejection_reason is null or length(rejection_reason)<=300)
);

alter table public.naxa_delivery_payment_records enable row level security;
revoke all on public.naxa_delivery_payment_records from public,anon,authenticated;
grant all on public.naxa_delivery_payment_records to service_role;

create index if not exists naxa_delivery_payment_pending_idx
  on public.naxa_delivery_payment_records(pharmacie_id,status,created_at desc);

create or replace function public.naxa_client_declarer_paiement_livraison(
  p_reservation uuid,
  p_reference text
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_r public.reservations%rowtype;
  v_reference text:=trim(coalesce(p_reference,''));
begin
  if v_uid is null then raise exception 'Connexion Client requise'; end if;
  if length(v_reference)<5 or length(v_reference)>120
    or v_reference !~ '^[[:alnum:][:space:]_./-]+$' then
    raise exception 'Référence de paiement invalide';
  end if;
  select * into v_r from public.reservations where id=p_reservation for update;
  if not found or v_r.client_id<>v_uid or v_r.mode<>'commande'
    or v_r.livraison_confirmee_stock_at is null
    or v_r.paiement_mode not in ('mtn_marchand','orange_money')
    or v_r.commande_statut not in ('acceptee','preparation','livreur_assigne')
    or v_r.paiement_statut='effectue' then
    raise exception 'La commande ne permet pas la déclaration de ce paiement';
  end if;
  if exists(select 1 from public.reservations r
    where r.pharmacie_id=v_r.pharmacie_id and r.paiement_ref=v_reference and r.id<>v_r.id) then
    raise exception 'Cette référence a déjà été utilisée dans cette pharmacie';
  end if;

  update public.reservations
  set paiement_ref=v_reference,
      paiement_statut='a_verifier'
  where id=p_reservation;

  insert into public.naxa_delivery_payment_records(
    reservation_id,pharmacie_id,client_id,mode,expected_amount,reference,status,declared_by
  ) values(
    v_r.id,v_r.pharmacie_id,v_uid,v_r.paiement_mode,
    v_r.total+v_r.frais_livraison,v_reference,'declared',v_uid
  )
  on conflict(reservation_id) do update
  set mode=excluded.mode,
      expected_amount=excluded.expected_amount,
      reference=excluded.reference,
      status='declared',
      declared_by=v_uid,
      declared_at=now(),
      cash_received=null,
      cash_change=0,
      validated_by=null,
      validated_at=null,
      caisse_session_id=null,
      vente_id=null,
      rejection_reason=null,
      updated_at=now()
  where public.naxa_delivery_payment_records.status<>'paid';

  if not found then raise exception 'Un paiement a déjà été validé pour cette commande'; end if;

  insert into public.notifications(pharmacie_id,type,titre,corps,reservation_id)
  values(v_r.pharmacie_id,'delivery_payment_declared','Paiement de livraison à vérifier',
    'Le client a déclaré avoir payé. Vérifiez la référence marchande dans la caisse ou sur le terminal Android avant de lancer la préparation.',
    v_r.id);
  return true;
end;
$function$;
revoke all on function public.naxa_client_declarer_paiement_livraison(uuid,text) from public,anon;
grant execute on function public.naxa_client_declarer_paiement_livraison(uuid,text) to authenticated;

create or replace function public.naxa_delivery_courier_declare_cash(
  p_mission uuid,
  p_cash_received integer
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
  v_r public.reservations%rowtype;
  v_due integer;
begin
  if v_uid is null then raise exception 'Connexion Livreur requise'; end if;
  if p_cash_received is null or p_cash_received<=0 then raise exception 'Montant espèces invalide'; end if;
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if not found or v_m.livreur_id is distinct from v_uid
    or v_m.statut<>'arrived' or public.naxa_business_function(v_uid)<>'livreur' then
    raise exception 'Seul le Livreur affecté peut déclarer les espèces à la remise';
  end if;
  select * into v_r from public.reservations where id=v_m.reservation_id for update;
  if v_r.mode<>'commande' or v_r.paiement_mode<>'especes_livraison'
    or v_r.livraison_confirmee_stock_at is null or v_r.paiement_statut='effectue' then
    raise exception 'Cette commande ne permet pas un encaissement espèces à la livraison';
  end if;
  v_due:=v_r.total+v_r.frais_livraison;
  if p_cash_received<v_due then raise exception 'Montant espèces insuffisant'; end if;

  insert into public.naxa_delivery_payment_records(
    reservation_id,mission_id,pharmacie_id,client_id,livreur_id,mode,expected_amount,
    cash_received,cash_change,status,declared_by,declared_at
  ) values(
    v_r.id,v_m.id,v_r.pharmacie_id,v_r.client_id,v_uid,'especes_livraison',
    v_due,p_cash_received,p_cash_received-v_due,'cash_declared',v_uid,now()
  )
  on conflict(reservation_id) do update
  set mission_id=v_m.id,livreur_id=v_uid,mode='especes_livraison',
      expected_amount=v_due,cash_received=p_cash_received,
      cash_change=p_cash_received-v_due,status='cash_declared',
      declared_by=v_uid,declared_at=now(),validated_by=null,validated_at=null,
      caisse_session_id=null,vente_id=null,rejection_reason=null,updated_at=now()
  where public.naxa_delivery_payment_records.status<>'paid';

  if not found then raise exception 'Un paiement est déjà validé pour cette commande'; end if;
  insert into public.notifications(pharmacie_id,type,titre,corps,reservation_id,related_entity_id)
  values(v_r.pharmacie_id,'delivery_cash_declared','Espèces reçues par le Livreur · validation requise',
    'Le Livreur déclare avoir reçu les espèces du Client. La Caisse doit rapprocher le montant avant clôture de la livraison.',
    v_r.id,v_m.id);
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_courier_declare_cash(uuid,integer) from public,anon;
grant execute on function public.naxa_delivery_courier_declare_cash(uuid,integer) to authenticated;

create or replace function public.naxa_delivery_pending_payment_list(p_pharmacie uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_result jsonb;
begin
  if v_uid is null or not public.naxa_caisse_actor_for_pharmacy(p_pharmacie) then
    raise exception 'La liste des paiements est réservée à la Caisse active de cette pharmacie';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'reservation_id',r.id,
    'mission_id',m.id,
    'reference_code',r.code_paiement,
    'client_id',r.client_id,
    'client_phone',r.telephone_livraison,
    'mode',r.paiement_mode,
    'reference',coalesce(pr.reference,r.paiement_ref),
    'expected_amount',r.total+r.frais_livraison,
    'cash_received',pr.cash_received,
    'cash_change',pr.cash_change,
    'payment_status',coalesce(pr.status,'declared'),
    'created_at',r.livraison_paiement_demande_at,
    'livreur_id',m.livreur_id
  ) order by r.livraison_paiement_demande_at),'[]'::jsonb)
  into v_result
  from public.reservations r
  left join public.naxa_delivery_missions m on m.reservation_id=r.id
  left join public.naxa_delivery_payment_records pr on pr.reservation_id=r.id
  where r.pharmacie_id=p_pharmacie and r.mode='commande'
    and r.livraison_confirmee_stock_at is not null
    and r.paiement_statut<>'effectue'
    and r.commande_statut in ('acceptee','preparation','livreur_assigne','en_livraison')
    and (
      (r.paiement_mode in ('mtn_marchand','orange_money') and pr.status='declared')
      or (r.paiement_mode='especes_livraison' and pr.status='cash_declared')
    );
  return v_result;
end;
$function$;
revoke all on function public.naxa_delivery_pending_payment_list(uuid) from public,anon;
grant execute on function public.naxa_delivery_pending_payment_list(uuid) to authenticated;

create or replace function public.naxa_delivery_current_caisse_session(p_pharmacie uuid)
returns uuid
language plpgsql
stable
security definer
set search_path=''
as $function$
declare v_uid uuid:=auth.uid(); v_session uuid;
begin
  if v_uid is null or not public.naxa_caisse_actor_for_pharmacy(p_pharmacie) then
    raise exception 'Caisse active requise';
  end if;
  select cs.id into v_session
  from public.caisses_sessions cs
  join public.caisses c on c.id=cs.caisse_id
  where c.pharmacie_id=p_pharmacie and c.actif=true
    and cs.statut='ouverte' and cs.ouvert_par=v_uid
  order by cs.ouvert_at desc
  limit 1;
  return v_session;
end;
$function$;
revoke all on function public.naxa_delivery_current_caisse_session(uuid) from public,anon;
grant execute on function public.naxa_delivery_current_caisse_session(uuid) to authenticated;

create or replace function public.naxa_delivery_pos_encaisser(
  p_reservation uuid,
  p_session uuid,
  p_montant_percu integer,
  p_canal text,
  p_code_paiement text,
  p_reference text default null
) returns table(vente_id uuid,numero_vente text,total integer,monnaie_rendue integer,canal text)
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_r public.reservations%rowtype;
  v_session public.caisses_sessions%rowtype;
  v_record public.naxa_delivery_payment_records%rowtype;
  v_sale uuid;
  v_number text;
  v_due integer;
  v_change integer:=0;
  v_mode public.mode_paiement_caisse;
  v_expected_channel text;
  v_existing uuid;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if p_reservation is null or p_session is null or p_code_paiement is null then
    raise exception 'Commande, session et code de paiement requis';
  end if;
  if p_montant_percu is null or p_montant_percu<=0 then raise exception 'Montant encaissé invalide'; end if;
  if p_canal not in ('especes','orange_money','mtn_momo','mobile_money') then
    raise exception 'Canal de paiement non pris en charge';
  end if;
  v_mode:=p_canal::public.mode_paiement_caisse;
  select * into v_r from public.reservations where id=p_reservation for update;
  if not found or v_r.mode<>'commande' or v_r.livraison_confirmee_stock_at is null
    or v_r.commande_statut not in ('acceptee','preparation','livreur_assigne','en_livraison')
    or v_r.statut in ('annulee','expiree','retiree') then
    raise exception 'Commande non éligible à un encaissement Livraison';
  end if;
  if upper(btrim(v_r.code_paiement))<>upper(btrim(p_code_paiement)) then
    raise exception 'Code de commande incorrect';
  end if;
  if not public.naxa_caisse_actor_for_pharmacy(v_r.pharmacie_id) then
    raise exception 'Encaissement réservé à la Caisse active de cette pharmacie';
  end if;
  select cs.* into v_session
  from public.caisses_sessions cs join public.caisses c on c.id=cs.caisse_id
  where cs.id=p_session and cs.statut='ouverte' and cs.ouvert_par=v_uid
    and c.actif=true and c.pharmacie_id=v_r.pharmacie_id
  for update of cs;
  if not found then raise exception 'Session Caisse ouverte introuvable ou hors pharmacie'; end if;
  select * into v_record from public.naxa_delivery_payment_records
  where reservation_id=v_r.id for update;
  if not found then raise exception 'Déclaration de paiement ou de remise espèces absente'; end if;
  if v_record.status='paid' then raise exception 'Paiement déjà validé'; end if;

  v_due:=v_r.total+v_r.frais_livraison;
  if p_canal='especes' then
    if v_r.paiement_mode<>'especes_livraison' or v_record.status<>'cash_declared'
      or v_record.cash_received is null or p_montant_percu<>v_record.cash_received
      or p_montant_percu<v_due then
      raise exception 'Les espèces doivent avoir été déclarées par le Livreur et rapprochées exactement';
    end if;
    v_change:=p_montant_percu-v_due;
    v_expected_channel:='especes';
  else
    v_expected_channel:=case when p_canal='mtn_momo' then 'mtn_marchand'
      when p_canal='orange_money' then 'orange_money' else 'mobile_money' end;
    if v_r.paiement_mode<>v_expected_channel or v_record.status<>'declared'
      or v_record.reference is null
      or upper(btrim(v_record.reference))<>upper(btrim(coalesce(p_reference,'')))
      or upper(btrim(coalesce(v_r.paiement_ref,'')))<>upper(btrim(coalesce(p_reference,'')))
      or p_montant_percu<>v_due then
      raise exception 'Référence, canal ou montant ne correspond pas à la déclaration du Client';
    end if;
  end if;
  if exists(select 1 from public.ventes v where v.reservation_id=v_r.id) then
    raise exception 'Une vente est déjà liée à cette commande';
  end if;

  insert into public.ventes(
    pharmacie_id,caisse_session_id,client_id,statut,remise,total_brut,total_net,
    frais_livraison,created_by,reservation_id,stock_decremented_at_draft
  ) values(
    v_r.pharmacie_id,p_session,v_r.client_id,'brouillon',0,v_r.total,v_due,
    v_r.frais_livraison,v_uid,v_r.id,true
  ) returning id,numero_vente into v_sale,v_number;

  insert into public.vente_lignes(vente_id,produit_id,quantite,prix_unitaire)
  select v_sale,ri.produit_id,ri.quantite,ri.prix_unitaire
  from public.reservation_items ri
  where ri.reservation_id=v_r.id
  order by ri.produit_id;

  insert into public.vente_paiements(
    vente_id,mode,montant,reference,created_by,montant_percu,monnaie_rendue
  ) values(
    v_sale,v_mode,v_due,
    coalesce(nullif(trim(p_reference),''),'Livraison espèces déclarée par le Livreur'),
    v_uid,p_montant_percu,v_change
  );

  update public.ventes set
    statut='payee',mode_paiement=v_mode,
    paiement_ref=coalesce(nullif(trim(p_reference),''),'Livraison espèces'),
    paid_at=now()
  where id=v_sale and statut='brouillon';
  if not found then raise exception 'La vente de livraison n’a pas pu être finalisée'; end if;

  update public.naxa_delivery_payment_records
  set status='paid',validated_by=v_uid,validated_at=now(),
      caisse_session_id=p_session,vente_id=v_sale,
      cash_change=v_change,updated_at=now()
  where id=v_record.id;

  update public.reservations set
    paiement_statut='effectue',
    paiement_montant_percu=p_montant_percu,
    paiement_monnaie_rendue=v_change,
    paiement_valide_at=now(),
    paiement_ticket_numero=v_number
  where id=v_r.id;
  perform public.set_reservation_status(v_r.id,'payee'::public.resa_statut);
  perform private.naxa_delivery_finalize_if_confirmed((select id from public.naxa_delivery_missions where reservation_id=v_r.id));

  insert into public.notifications(user_id,type,titre,corps,reservation_id,related_entity_id)
  values(v_r.client_id,'delivery_payment_confirmed','Paiement de livraison confirmé',
    'La pharmacie a validé votre paiement. Votre reçu est disponible dans le suivi de commande.',
    v_r.id,v_sale);
  return query select v_sale,v_number,v_due,v_change,p_canal;
end;
$function$;
revoke all on function public.naxa_delivery_pos_encaisser(uuid,uuid,integer,text,text,text) from public,anon;
grant execute on function public.naxa_delivery_pos_encaisser(uuid,uuid,integer,text,text,text) to authenticated;

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
  if v_r.paiement_statut<>'effectue' then return false; end if;
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
  values(v_m.id,v_m.reservation_id,v_m.pharmacie_id,v_m.livreur_id,'delivered','Réception Client et Livreur confirmée après paiement validé')
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

create or replace function public.naxa_delivery_monthly_due(p_month date default date_trunc('month',current_date)::date)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_first date:=date_trunc('month',p_month)::date;
  v_last date:=(date_trunc('month',p_month)+interval '1 month - 1 day')::date;
  v_result jsonb;
begin
  if v_uid is null or p_month is null then raise exception 'Session et mois requis'; end if;
  v_role:=public.naxa_business_function(v_uid);
  if not public.is_admin() and v_role<>'promoteur' then
    raise exception 'Décompte mensuel réservé à l’Administration et au Promoteur';
  end if;

  with scope as (
    select ph.id as pharmacie_id,ph.nom,ph.ville,
      coalesce(ab.montant_mensuel,0)::integer as abonnement_mensuel
    from public.pharmacies ph
    left join lateral (
      select a.montant_mensuel from public.abonnements a
      where a.pharmacie_id=ph.id and a.statut='actif'
      order by a.created_at desc limit 1
    ) ab on true
    where ph.actif=true and ph.archivee_le is null
      and (
        public.is_admin()
        or exists(select 1 from public.promoteur_pharmacies pp
          where pp.promoteur_id=v_uid and pp.pharmacie_id=ph.id and pp.actif)
      )
  ),
  commissions as (
    select l.pharmacie_id,
      coalesce(sum(l.commission_naxa) filter(where l.regle_le is null),0)::integer as commission_a_payer,
      coalesce(sum(l.commission_naxa) filter(where l.regle_le is not null),0)::integer as commission_deja_reglee,
      count(*)::integer as livraisons
    from public.naxa_delivery_commission_ledger l
    where l.settlement_month=v_first
    group by l.pharmacie_id
  ),
  detail as (
    select s.pharmacie_id,s.nom,s.ville,s.abonnement_mensuel,
      coalesce(c.commission_a_payer,0) as commission_a_payer,
      coalesce(c.commission_deja_reglee,0) as commission_deja_reglee,
      coalesce(c.livraisons,0) as livraisons,
      s.abonnement_mensuel+coalesce(c.commission_a_payer,0) as total_mensuel_du
    from scope s left join commissions c on c.pharmacie_id=s.pharmacie_id
  )
  select jsonb_build_object(
    'periode_du',v_first,'periode_au',v_last,
    'totaux',jsonb_build_object(
      'abonnements',coalesce(sum(abonnement_mensuel),0),
      'commissions_livraison',coalesce(sum(commission_a_payer),0),
      'commissions_deja_reglees',coalesce(sum(commission_deja_reglee),0),
      'total_a_payer',coalesce(sum(total_mensuel_du),0),
      'livraisons',coalesce(sum(livraisons),0)
    ),
    'par_pharmacie',coalesce(jsonb_agg(to_jsonb(detail) order by total_mensuel_du desc),'[]'::jsonb)
  ) into v_result from detail;
  return v_result;
end;
$function$;
revoke all on function public.naxa_delivery_monthly_due(date) from public,anon;
grant execute on function public.naxa_delivery_monthly_due(date) to authenticated;

commit;
