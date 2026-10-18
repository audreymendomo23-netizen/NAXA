-- NAXA 114 — notifications in-app pour les demandes de prestations à domicile.
-- Réutilise public.notifications et son RLS existants (migration 075).
-- N'envoie aucune adresse exacte dans les notifications.
begin;

create or replace function public.notify_home_service_request_created()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
begin
  insert into public.notifications(user_id,type,titre,corps)
  select distinct pm.user_id,
    'home_service_request',
    'Nouvelle demande à domicile',
    left('Demande : '||new.offer_name||' · Zone : '||new.service_area_label,1000)
  from public.partner_members pm
  join public.partners p on p.id=pm.partner_id and p.status='active'
  where pm.partner_id=new.partner_id
    and pm.member_role in ('owner','manager','operator')
    and pm.user_id is not null;

  return new;
end;
$function$;

drop trigger if exists home_service_request_created_notification on public.home_service_requests;
create trigger home_service_request_created_notification
after insert on public.home_service_requests
for each row execute function public.notify_home_service_request_created();

create or replace function public.notify_home_service_request_status()
returns trigger
language plpgsql
security definer
set search_path=public
as $function$
declare
  actor uuid := auth.uid();
  status_label text;
begin
  if new.status is not distinct from old.status then return new; end if;

  status_label := case new.status
    when 'confirmed' then 'confirmée par le professionnel'
    when 'completed' then 'terminée'
    when 'cancelled' then 'annulée'
    when 'expired' then 'expirée'
    else new.status
  end;

  -- Si le client annule, informer les responsables du partenaire.
  if new.status='cancelled' and actor=new.client_id then
    insert into public.notifications(user_id,type,titre,corps)
    select distinct pm.user_id,
      'home_service_request',
      'Demande à domicile annulée',
      left('La demande « '||new.offer_name||' » a été annulée par le client.',1000)
    from public.partner_members pm
    join public.partners p on p.id=pm.partner_id and p.status='active'
    where pm.partner_id=new.partner_id
      and pm.member_role in ('owner','manager','operator')
      and pm.user_id is not null;
  else
    -- Une confirmation, une clôture ou une action administrative informe le client.
    insert into public.notifications(user_id,type,titre,corps)
    values(
      new.client_id,
      'home_service_request',
      case new.status
        when 'confirmed' then 'Prestation confirmée'
        when 'completed' then 'Prestation terminée'
        when 'cancelled' then 'Demande annulée'
        when 'expired' then 'Demande expirée'
        else 'Mise à jour de votre demande'
      end,
      left('Votre demande « '||new.offer_name||' » est maintenant '||status_label||'.',1000)
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists home_service_request_status_notification on public.home_service_requests;
create trigger home_service_request_status_notification
after update of status on public.home_service_requests
for each row execute function public.notify_home_service_request_status();

revoke all on function public.notify_home_service_request_created() from public,anon,authenticated;
revoke all on function public.notify_home_service_request_status() from public,anon,authenticated;

commit;
