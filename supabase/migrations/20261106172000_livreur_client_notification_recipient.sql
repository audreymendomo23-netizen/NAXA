-- NAXA — le destinataire d'une notification Client est exclusivement user_id.
begin;

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
  insert into public.notifications(user_id,type,titre,corps,reservation_id,related_entity_id)
  values(v_client,'delivery_update',v_title,v_body,new.reservation_id,new.mission_id);
  return new;
end;
$function$;
revoke all on function private.naxa_delivery_client_notification() from public,anon,authenticated;

commit;
