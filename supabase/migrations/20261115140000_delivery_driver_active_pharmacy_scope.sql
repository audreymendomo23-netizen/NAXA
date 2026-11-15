create or replace function public.naxa_delivery_confirm_handover(p_mission uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
begin
  if v_uid is null then
    raise exception 'Connexion Livreur requise';
  end if;
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if not found or v_m.livreur_id is distinct from v_uid
    or v_m.statut<>'arrived'
    or not private.naxa_delivery_driver_can_act(v_uid,p_mission) then
    raise exception 'Seul le Livreur affecté, dans sa pharmacie active, peut confirmer la remise';
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

create or replace function public.naxa_delivery_courier_declare_cash(
  p_mission uuid,
  p_cash_received integer
)
returns boolean
language plpgsql
security definer
set search_path to ''
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
    or v_m.statut<>'arrived'
    or not private.naxa_delivery_driver_can_act(v_uid,p_mission) then
    raise exception 'Seul le Livreur affecté à cette pharmacie active peut déclarer les espèces';
  end if;

  select * into v_r from public.reservations where id=v_m.reservation_id for update;
  if v_r.mode<>'commande' or v_r.paiement_mode is distinct from 'especes_livraison'
    or v_r.livraison_confirmee_stock_at is null or v_r.paiement_statut='effectue' then
    raise exception 'Cette commande ne permet pas un encaissement espèces à la livraison';
  end if;

  v_due:=v_r.total+v_r.frais_livraison;
  if p_cash_received<v_due then raise exception 'Montant espèces insuffisant'; end if;

  insert into public.naxa_delivery_payment_records(
    reservation_id,mission_id,pharmacie_id,client_id,livreur_id,mode,expected_amount,
    cash_received,cash_change,status,declared_by,declared_at
  ) values(
    v_r.id,v_m.id,v_m.pharmacie_id,v_r.client_id,v_uid,'especes_livraison',
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
    'Le Livreur déclare avoir reçu les espèces du Client. La Caisse doit rapprocher et valider l’encaissement avant clôture de la livraison.',
    v_r.id,v_m.id);
  return true;
end;
$function$;
