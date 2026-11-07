begin;

alter table public.naxa_delivery_mission_messages
  add column if not exists message_type text not null default 'text',
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists accuracy_m double precision;

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid='public.naxa_delivery_mission_messages'::regclass
      and conname='naxa_delivery_message_type_check'
  ) then
    alter table public.naxa_delivery_mission_messages
      add constraint naxa_delivery_message_type_check
      check (message_type in ('text','location'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.naxa_delivery_mission_messages'::regclass
      and conname='naxa_delivery_message_location_check'
  ) then
    alter table public.naxa_delivery_mission_messages
      add constraint naxa_delivery_message_location_check
      check (
        (message_type='text' and latitude is null and longitude is null and accuracy_m is null)
        or
        (message_type='location'
          and latitude is not null and longitude is not null
          and latitude between -90 and 90
          and longitude between -180 and 180
          and (accuracy_m is null or accuracy_m between 0 and 10000))
      );
  end if;
end;
$constraints$;

create or replace function public.naxa_delivery_list_messages(p_reservation uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
  v_messages jsonb;
  v_can_send boolean;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select * into v_m from public.naxa_delivery_missions where reservation_id=p_reservation;
  if not found then raise exception 'Mission de livraison introuvable'; end if;

  if v_uid<>v_m.client_id
    and (v_uid is distinct from v_m.livreur_id
      or public.naxa_business_function(v_uid)<>'livreur') then
    raise exception 'Cette conversation est réservée au Client et au Livreur affecté';
  end if;

  if v_m.livreur_id is null then
    return jsonb_build_object(
      'available',false,'can_send',false,'messages','[]'::jsonb,
      'notice','La conversation s’ouvrira dès qu’un Livreur aura accepté la mission.'
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',msg.id,'sender_id',msg.sender_id,'sender_role',msg.sender_role,
    'body',msg.body,'message_type',msg.message_type,
    'latitude',msg.latitude,'longitude',msg.longitude,
    'accuracy_m',msg.accuracy_m,'created_at',msg.created_at
  ) order by msg.created_at,msg.id),'[]'::jsonb)
  into v_messages
  from public.naxa_delivery_mission_messages msg
  where msg.mission_id=v_m.id;

  v_can_send:=v_m.statut in ('accepted','picked_up','arrived');
  return jsonb_build_object(
    'available',true,'can_send',v_can_send,'messages',v_messages,
    'notice',case when v_can_send then null else 'La livraison est terminée ou interrompue : la conversation est en lecture seule.' end
  );
end;
$function$;
revoke all on function public.naxa_delivery_list_messages(uuid) from public,anon;
grant execute on function public.naxa_delivery_list_messages(uuid) to authenticated;

create or replace function public.naxa_delivery_send_location(
  p_reservation uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_m double precision default null
) returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
  v_sender_role text;
  v_recipient uuid;
  v_message uuid;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if p_latitude is null or p_longitude is null
    or p_latitude not between -90 and 90
    or p_longitude not between -180 and 180
    or (p_accuracy_m is not null and p_accuracy_m not between 0 and 10000) then
    raise exception 'Coordonnées GPS invalides';
  end if;

  select * into v_m
  from public.naxa_delivery_missions
  where reservation_id=p_reservation
  for update;

  if not found or v_m.livreur_id is null then
    raise exception 'Aucun Livreur n’a encore accepté cette livraison';
  end if;
  if v_m.statut not in ('accepted','picked_up','arrived') then
    raise exception 'Le partage de position est fermé pour cette livraison';
  end if;

  if v_uid=v_m.client_id then
    v_sender_role:='client';
    v_recipient:=v_m.livreur_id;
  elsif v_uid=v_m.livreur_id and public.naxa_business_function(v_uid)='livreur' then
    v_sender_role:='livreur';
    v_recipient:=v_m.client_id;
  else
    raise exception 'Seuls le Client et le Livreur affecté peuvent partager leur position';
  end if;

  if (select count(*) from public.naxa_delivery_mission_messages msg
      where msg.mission_id=v_m.id and msg.sender_id=v_uid
        and msg.created_at>now()-interval '1 minute')>=12 then
    raise exception 'Veuillez patienter avant de partager une nouvelle position';
  end if;

  insert into public.naxa_delivery_mission_messages(
    mission_id,reservation_id,sender_id,sender_role,body,message_type,
    latitude,longitude,accuracy_m
  ) values(
    v_m.id,v_m.reservation_id,v_uid,v_sender_role,'Position géographique partagée',
    'location',p_latitude,p_longitude,p_accuracy_m
  ) returning id into v_message;

  insert into public.notifications(
    user_id,type,titre,corps,reservation_id,related_entity_id
  ) values(
    v_recipient,'delivery_message',
    case when v_sender_role='client' then 'Position du Client partagée' else 'Position du Livreur partagée' end,
    'Une position a été partagée dans votre conversation de livraison.',
    v_m.reservation_id,v_m.id
  );

  return v_message;
end;
$function$;
revoke all on function public.naxa_delivery_send_location(uuid,double precision,double precision,double precision) from public,anon;
grant execute on function public.naxa_delivery_send_location(uuid,double precision,double precision,double precision) to authenticated;

commit;