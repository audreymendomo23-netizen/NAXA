-- Enforce active courier authorization for both sides of mission chat and GPS.
-- The helper also checks the selected role, current active assignment, profile,
-- active non-archived pharmacy, prepared stock and selected/verified payment.

create or replace function public.naxa_delivery_send_message(
  p_reservation uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
  v_body text := trim(coalesce(p_body, ''));
  v_sender_role text;
  v_recipient uuid;
  v_message uuid;
  v_notification_title text;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;
  if length(v_body) < 1 or length(v_body) > 1000 then
    raise exception 'Le message doit contenir entre 1 et 1 000 caractères';
  end if;

  select *
    into v_m
  from public.naxa_delivery_missions
  where reservation_id = p_reservation
  for update;

  if not found or v_m.livreur_id is null then
    raise exception 'Aucun Livreur n’a encore accepté cette livraison';
  end if;
  if v_m.statut not in ('accepted', 'picked_up', 'arrived') then
    raise exception 'La messagerie est fermée pour cette livraison';
  end if;
  if not exists (
    select 1 from public.pharmacies ph
    where ph.id = v_m.pharmacie_id
      and ph.actif = true
      and ph.archivee_le is null
  ) then
    raise exception 'La pharmacie est suspendue ou archivée ; messagerie indisponible';
  end if;
  if not private.naxa_delivery_driver_can_act(v_m.livreur_id, v_m.id) then
    raise exception 'Le Livreur affecté ou son autorisation de pharmacie n’est plus active';
  end if;

  if v_uid = v_m.client_id then
    v_sender_role := 'client';
    v_recipient := v_m.livreur_id;
    v_notification_title := 'Nouveau message du Client';
  elsif v_uid = v_m.livreur_id and private.naxa_business_function(v_uid) = 'livreur' then
    v_sender_role := 'livreur';
    v_recipient := v_m.client_id;
    v_notification_title := 'Nouveau message du Livreur';
  else
    raise exception 'Seuls le Client et le Livreur affecté peuvent écrire dans cette conversation';
  end if;

  if (
    select count(*)
    from public.naxa_delivery_mission_messages msg
    where msg.mission_id = v_m.id
      and msg.sender_id = v_uid
      and msg.created_at > now() - interval '1 minute'
  ) >= 12 then
    raise exception 'Veuillez patienter avant d’envoyer d’autres messages';
  end if;

  insert into public.naxa_delivery_mission_messages (
    mission_id, reservation_id, sender_id, sender_role, body
  ) values (
    v_m.id, v_m.reservation_id, v_uid, v_sender_role, v_body
  ) returning id into v_message;

  insert into public.notifications (
    user_id, type, titre, corps, reservation_id, related_entity_id
  ) values (
    v_recipient, 'delivery_message', v_notification_title,
    left(v_body, 240), v_m.reservation_id, v_m.id
  );

  return v_message;
end;
$function$;

create or replace function public.naxa_delivery_send_location(
  p_reservation uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
  v_sender_role text;
  v_recipient uuid;
  v_message uuid;
begin
  if v_uid is null then
    raise exception 'Connexion requise';
  end if;
  if p_latitude is null or p_longitude is null
    or p_latitude not between -90 and 90
    or p_longitude not between -180 and 180
    or (p_accuracy_m is not null and p_accuracy_m not between 0 and 10000) then
    raise exception 'Coordonnées GPS invalides';
  end if;

  select *
    into v_m
  from public.naxa_delivery_missions
  where reservation_id = p_reservation
  for update;

  if not found or v_m.livreur_id is null then
    raise exception 'Aucun Livreur n’a encore accepté cette livraison';
  end if;
  if v_m.statut not in ('accepted', 'picked_up', 'arrived') then
    raise exception 'Le partage de position est fermé pour cette livraison';
  end if;
  if not exists (
    select 1 from public.pharmacies ph
    where ph.id = v_m.pharmacie_id
      and ph.actif = true
      and ph.archivee_le is null
  ) then
    raise exception 'La pharmacie est suspendue ou archivée ; partage GPS indisponible';
  end if;
  if not private.naxa_delivery_driver_can_act(v_m.livreur_id, v_m.id) then
    raise exception 'Le Livreur affecté ou son autorisation de pharmacie n’est plus active';
  end if;

  if v_uid = v_m.client_id then
    v_sender_role := 'client';
    v_recipient := v_m.livreur_id;
  elsif v_uid = v_m.livreur_id and private.naxa_business_function(v_uid) = 'livreur' then
    v_sender_role := 'livreur';
    v_recipient := v_m.client_id;
  else
    raise exception 'Seuls le Client et le Livreur affecté peuvent partager leur position';
  end if;

  if (
    select count(*)
    from public.naxa_delivery_mission_messages msg
    where msg.mission_id = v_m.id
      and msg.sender_id = v_uid
      and msg.created_at > now() - interval '1 minute'
  ) >= 12 then
    raise exception 'Veuillez patienter avant de partager une nouvelle position';
  end if;

  insert into public.naxa_delivery_mission_messages (
    mission_id, reservation_id, sender_id, sender_role, body,
    message_type, latitude, longitude, accuracy_m
  ) values (
    v_m.id, v_m.reservation_id, v_uid, v_sender_role,
    'Position géographique partagée', 'location',
    p_latitude, p_longitude, p_accuracy_m
  ) returning id into v_message;

  insert into public.notifications (
    user_id, type, titre, corps, reservation_id, related_entity_id
  ) values (
    v_recipient, 'delivery_message',
    case when v_sender_role = 'client'
      then 'Position du Client partagée'
      else 'Position du Livreur partagée'
    end,
    'Une position a été partagée dans votre conversation de livraison.',
    v_m.reservation_id, v_m.id
  );

  return v_message;
end;
$function$;
