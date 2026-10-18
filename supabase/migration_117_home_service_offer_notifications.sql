-- NAXA 117 — notifier l'administration des nouvelles offres et les partenaires des décisions.
begin;

create or replace function public.notify_home_service_offer_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare partner_label text;
begin
  select p.name into partner_label from public.partners p where p.id=new.partner_id;
  insert into public.notifications(user_id,type,titre,corps)
  select distinct p.id,
    'home_service_offer',
    'Nouvelle prestation à valider',
    left('« '||new.name||' » a été soumise par '||coalesce(partner_label,'un partenaire')||'.',1000)
  from public.profiles p
  where p.role='admin' and new.status='draft';
  return new;
end;
$function$;

drop trigger if exists home_service_offer_created_notification on public.home_service_offers;
create trigger home_service_offer_created_notification
after insert on public.home_service_offers
for each row execute function public.notify_home_service_offer_created();

create or replace function public.notify_home_service_offer_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare status_label text;
begin
  if new.status is not distinct from old.status then return new; end if;
  status_label := case new.status
    when 'active' then 'publiée par NAXA'
    when 'draft' then 'remise en brouillon'
    when 'archived' then 'archivée'
    else new.status
  end;
  insert into public.notifications(user_id,type,titre,corps)
  select distinct pm.user_id,
    'home_service_offer',
    case new.status
      when 'active' then 'Prestation publiée'
      when 'draft' then 'Prestation remise en brouillon'
      when 'archived' then 'Prestation archivée'
      else 'Statut de prestation modifié'
    end,
    left('Votre prestation « '||new.name||' » a été '||status_label||'.',1000)
  from public.partner_members pm
  join public.partners p on p.id=pm.partner_id and p.status='active'
  where pm.partner_id=new.partner_id
    and pm.member_role in ('owner','manager','operator')
    and pm.user_id is not null;
  return new;
end;
$function$;

drop trigger if exists home_service_offer_status_notification on public.home_service_offers;
create trigger home_service_offer_status_notification
after update of status on public.home_service_offers
for each row execute function public.notify_home_service_offer_status();

revoke all on function public.notify_home_service_offer_created() from public,anon,authenticated;
revoke all on function public.notify_home_service_offer_status() from public,anon,authenticated;

commit;
