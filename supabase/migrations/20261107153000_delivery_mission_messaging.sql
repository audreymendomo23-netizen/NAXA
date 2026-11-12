begin;

create table if not exists public.naxa_delivery_mission_messages (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.naxa_delivery_missions(id) on delete cascade,
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  sender_role text not null check (sender_role in ('client','livreur')),
  body text not null check (length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists naxa_delivery_mission_messages_thread_idx
  on public.naxa_delivery_mission_messages(mission_id,created_at,id);

alter table public.naxa_delivery_mission_messages enable row level security;
revoke all on public.naxa_delivery_mission_messages from public,anon,authenticated;
grant all on public.naxa_delivery_mission_messages to service_role;

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
  select * into v_m
  from public.naxa_delivery_missions
  where reservation_id=p_reservation;

  if not found then
    raise exception 'Mission de livraison introuvable';
  end if;

  if v_uid<>v_m.client_id
    and (v_uid is distinct from v_m.livreur_id
      or public.naxa_business_function(v_uid)<>'livreur') then
    raise exception 'Cette conversation est réservée au Client et au Livreur affecté';
  end if;

  if v_m.livreur_id is null then
    return jsonb_build_object(
      'available',false,
      'can_send',false,
      'messages','[]'::jsonb,
      'notice','La conversation s’ouvrira dès qu’un Livreur aura accepté la mission.'
    );
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',msg.id,
    'sender_id',msg.sender_id,
    'sender_role',msg.sender_role,
    'body',msg.body,
    'created_at',msg.created_at
  ) order by msg.created_at,msg.id),'[]'::jsonb)
  into v_messages
  from public.naxa_delivery_mission_messages msg
  where msg.mission_id=v_m.id;

  v_can_send:=v_m.statut in ('accepted','picked_up','arrived');
  return jsonb_build_object(
    'available',true,
    'can_send',v_can_send,
    'messages',v_messages,
    'notice',case when v_can_send then null else 'La livraison est terminée ou interrompue : la conversation est en lecture seule.' end
  );
end;
$function$;
revoke all on function public.naxa_delivery_list_messages(uuid) from public,anon;
grant execute on function public.naxa_delivery_list_messages(uuid) to authenticated;

create or replace function public.naxa_delivery_send_message(
  p_reservation uuid,
  p_body text
) returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
  v_body text:=trim(coalesce(p_body,''));
  v_sender_role text;
  v_recipient uuid;
  v_message uuid;
  v_notification_title text;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if length(v_body)<1 or length(v_body)>1000 then
    raise exception 'Le message doit contenir entre 1 et 1 000 caractères';
  end if;

  select * into v_m
  from public.naxa_delivery_missions
  where reservation_id=p_reservation
  for update;

  if not found or v_m.livreur_id is null then
    raise exception 'Aucun Livreur n’a encore accepté cette livraison';
  end if;
  if v_m.statut not in ('accepted','picked_up','arrived') then
    raise exception 'La messagerie est fermée pour cette livraison';
  end if;

  if v_uid=v_m.client_id then
    v_sender_role:='client';
    v_recipient:=v_m.livreur_id;
    v_notification_title:='Nouveau message du Client';
  elsif v_uid=v_m.livreur_id and public.naxa_business_function(v_uid)='livreur' then
    v_sender_role:='livreur';
    v_recipient:=v_m.client_id;
    v_notification_title:='Nouveau message du Livreur';
  else
    raise exception 'Seuls le Client et le Livreur affecté peuvent écrire dans cette conversation';
  end if;

  if (select count(*) from public.naxa_delivery_mission_messages msg
      where msg.mission_id=v_m.id and msg.sender_id=v_uid
        and msg.created_at>now()-interval '1 minute')>=12 then
    raise exception 'Veuillez patienter avant d’envoyer d’autres messages';
  end if;

  insert into public.naxa_delivery_mission_messages(
    mission_id,reservation_id,sender_id,sender_role,body
  ) values(
    v_m.id,v_m.reservation_id,v_uid,v_sender_role,v_body
  ) returning id into v_message;

  insert into public.notifications(
    user_id,type,titre,corps,reservation_id,related_entity_id
  ) values(
    v_recipient,'delivery_message',v_notification_title,
    left(v_body,240),v_m.reservation_id,v_m.id
  );

  return v_message;
end;
$function$;
revoke all on function public.naxa_delivery_send_message(uuid,text) from public,anon;
grant execute on function public.naxa_delivery_send_message(uuid,text) to authenticated;

commit;
