-- NAXA — cycle de vie fiable des rappels Prestations et de la file Push globale.
-- Annule les rappels devenus obsolètes, reprogramme un créneau modifié et termine les retries épuisés.
begin;

alter table public.home_service_reminder_dispatches
  drop constraint if exists home_service_reminder_dispatches_state_check;
alter table public.home_service_reminder_dispatches
  add constraint home_service_reminder_dispatches_state_check
  check (state in ('pending','processing','sent','cancelled','failed'));

alter table public.naxa_notification_push_outbox
  drop constraint if exists naxa_notification_push_outbox_state_check;
alter table public.naxa_notification_push_outbox
  add constraint naxa_notification_push_outbox_state_check
  check (state in ('pending','processing','sent','failed'));

create or replace function public.sync_home_service_reminder_lifecycle()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if new.status='confirmed' and new.scheduled_at is not null then
    if old.status is distinct from 'confirmed'
      or old.scheduled_at is distinct from new.scheduled_at then
      -- Une reprogrammation crée un nouveau cycle de rappels pour le même rendez-vous.
      update public.home_service_reminder_dispatches d
      set state='pending',
          scheduled_at=new.scheduled_at,
          due_at=new.scheduled_at-(d.offset_minutes * interval '1 minute'),
          notification_created_at=null,
          locked_at=null,
          attempts=0,
          last_error=null,
          updated_at=now()
      where d.request_id=new.id;
    end if;
  else
    -- Annulation, expiration, clôture ou perte du créneau : aucun rappel futur ne doit partir.
    update public.home_service_reminder_dispatches d
    set state='cancelled',
        locked_at=null,
        last_error=case
          when new.status='cancelled' then 'appointment_cancelled'
          when new.status='expired' then 'appointment_expired'
          when new.status='completed' then 'appointment_completed'
          else 'appointment_not_confirmed'
        end,
        updated_at=now()
    where d.request_id=new.id
      and d.state in ('pending','processing');
  end if;

  return new;
end;
$function$;

revoke all on function public.sync_home_service_reminder_lifecycle() from public,anon,authenticated;

drop trigger if exists home_service_reminder_lifecycle_sync on public.home_service_requests;
create trigger home_service_reminder_lifecycle_sync
after update of status,scheduled_at on public.home_service_requests
for each row
execute function public.sync_home_service_reminder_lifecycle();

create or replace function public.claim_home_service_reminder_dispatches(p_batch_size integer default 500)
returns table(
  dispatch_id uuid,
  request_id uuid,
  recipient_id uuid,
  offset_minutes integer,
  scheduled_at timestamptz,
  notification_created_at timestamptz,
  attempts integer
)
language plpgsql
security definer
set search_path=''
as $function$
begin
  return query
  with picked as (
    select d.id as dispatch_id
    from public.home_service_reminder_dispatches d
    join public.home_service_requests r on r.id=d.request_id
    where d.due_at<=now()
      and d.attempts<12
      and d.state in ('pending','processing')
      and r.status='confirmed'
      and r.scheduled_at is not null
      and r.scheduled_at=d.scheduled_at
      and (
        d.state='pending'
        or (d.state='processing' and coalesce(d.locked_at,d.updated_at)<now()-interval '10 minutes')
      )
    order by d.due_at,d.created_at
    limit greatest(1,least(coalesce(p_batch_size,500),1000))
    for update of d skip locked
  ), claimed as (
    update public.home_service_reminder_dispatches d
    set state='processing',locked_at=now(),attempts=d.attempts+1,
        updated_at=now(),last_error=null
    from picked p
    where d.id=p.dispatch_id
    returning d.id as dispatch_id,d.request_id,d.recipient_id,d.offset_minutes,
      d.scheduled_at,d.notification_created_at,d.attempts
  )
  select c.dispatch_id,c.request_id,c.recipient_id,c.offset_minutes,
    c.scheduled_at,c.notification_created_at,c.attempts
  from claimed c;
end;
$function$;

revoke all on function public.claim_home_service_reminder_dispatches(integer) from public,anon,authenticated;
grant execute on function public.claim_home_service_reminder_dispatches(integer) to service_role;

commit;
