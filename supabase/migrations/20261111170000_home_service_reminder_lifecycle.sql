-- NAXA — cycle de vie complet des rappels Prestations.
-- Annulation, reprogrammation, préférences et périmètres actifs synchronisés en base.
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

-- Une seule routine applique les préférences + l'état réel du partenaire/membre.
create or replace function public.sync_home_service_reminder_user_scope(
  p_partner_id uuid,
  p_user_id uuid
) returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_offsets integer[];
begin
  if p_partner_id is null or p_user_id is null then return; end if;

  if not exists (
    select 1
    from public.partners p
    join public.partner_members pm on pm.partner_id=p.id
    join public.profiles pr on pr.id=pm.user_id
    where p.id=p_partner_id
      and p.status='active'
      and p.partner_type='professionnel_domicile'
      and pm.user_id=p_user_id
      and pm.member_role in ('owner','manager','operator')
      and pr.actif=true
  ) then
    update public.home_service_reminder_dispatches d
    set state='cancelled',locked_at=null,
        last_error='partner_or_member_inactive',updated_at=now()
    from public.home_service_requests r
    where r.id=d.request_id and r.partner_id=p_partner_id
      and d.recipient_id=p_user_id and d.state in ('pending','processing');
    return;
  end if;

  select pref.offsets_minutes into v_offsets
  from public.home_service_reminder_preferences pref
  where pref.partner_id=p_partner_id and pref.user_id=p_user_id
    and pref.enabled=true;

  if not found or coalesce(cardinality(v_offsets),0)=0 then
    update public.home_service_reminder_dispatches d
    set state='cancelled',locked_at=null,
        last_error='reminders_disabled',updated_at=now()
    from public.home_service_requests r
    where r.id=d.request_id and r.partner_id=p_partner_id
      and d.recipient_id=p_user_id and d.state in ('pending','processing');
    return;
  end if;

  update public.home_service_reminder_dispatches d
  set state='cancelled',locked_at=null,
      last_error='reminder_preference_removed',updated_at=now()
  from public.home_service_requests r
  where r.id=d.request_id and r.partner_id=p_partner_id
    and d.recipient_id=p_user_id
    and d.state in ('pending','processing')
    and not (d.offset_minutes = any(v_offsets));

  insert into public.home_service_reminder_dispatches(
    request_id,recipient_id,offset_minutes,scheduled_at,due_at
  )
  select r.id,p_user_id,o.offset_minutes,r.scheduled_at,
    r.scheduled_at-(o.offset_minutes * interval '1 minute')
  from public.home_service_requests r
  cross join lateral unnest(v_offsets) as o(offset_minutes)
  where r.partner_id=p_partner_id
    and r.status='confirmed'
    and r.scheduled_at is not null
    and r.scheduled_at>now()
  on conflict(request_id,recipient_id,offset_minutes) do update
  set scheduled_at=excluded.scheduled_at,
      due_at=excluded.due_at,
      state='pending',
      notification_created_at=null,
      locked_at=null,
      attempts=0,
      last_error=null,
      updated_at=now()
  where public.home_service_reminder_dispatches.state in ('cancelled','failed')
     or (
       public.home_service_reminder_dispatches.state in ('pending','processing')
       and public.home_service_reminder_dispatches.scheduled_at is distinct from excluded.scheduled_at
     );
end;
$function$;

revoke all on function public.sync_home_service_reminder_user_scope(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.sync_home_service_reminder_preferences_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if tg_op='DELETE' then
    perform public.sync_home_service_reminder_user_scope(old.partner_id,old.user_id);
    return old;
  end if;
  if tg_op='UPDATE' and
    (old.partner_id is distinct from new.partner_id or old.user_id is distinct from new.user_id) then
    perform public.sync_home_service_reminder_user_scope(old.partner_id,old.user_id);
  end if;
  perform public.sync_home_service_reminder_user_scope(new.partner_id,new.user_id);
  return new;
end;
$function$;

create or replace function public.sync_home_service_reminder_members_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if tg_op='DELETE' then
    perform public.sync_home_service_reminder_user_scope(old.partner_id,old.user_id);
    return old;
  end if;
  if tg_op='UPDATE' then
    perform public.sync_home_service_reminder_user_scope(old.partner_id,old.user_id);
  end if;
  perform public.sync_home_service_reminder_user_scope(new.partner_id,new.user_id);
  return new;
end;
$function$;

create or replace function public.sync_home_service_reminder_partner_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare v_user_id uuid;
begin
  if old.status is not distinct from new.status
    and old.partner_type is not distinct from new.partner_type then
    return new;
  end if;
  for v_user_id in
    select pm.user_id from public.partner_members pm where pm.partner_id=new.id
  loop
    perform public.sync_home_service_reminder_user_scope(new.id,v_user_id);
  end loop;
  return new;
end;
$function$;

create or replace function public.sync_home_service_reminder_profile_trigger()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare v_partner_id uuid;
begin
  if old.actif is not distinct from new.actif then return new; end if;
  for v_partner_id in
    select pm.partner_id from public.partner_members pm where pm.user_id=new.id
  loop
    perform public.sync_home_service_reminder_user_scope(v_partner_id,new.id);
  end loop;
  return new;
end;
$function$;

revoke all on function public.sync_home_service_reminder_preferences_trigger() from public,anon,authenticated;
revoke all on function public.sync_home_service_reminder_members_trigger() from public,anon,authenticated;
revoke all on function public.sync_home_service_reminder_partner_trigger() from public,anon,authenticated;
revoke all on function public.sync_home_service_reminder_profile_trigger() from public,anon,authenticated;

drop trigger if exists home_service_reminder_preferences_sync on public.home_service_reminder_preferences;
create trigger home_service_reminder_preferences_sync
after insert or update or delete on public.home_service_reminder_preferences
for each row execute function public.sync_home_service_reminder_preferences_trigger();

drop trigger if exists home_service_reminder_members_sync on public.partner_members;
create trigger home_service_reminder_members_sync
after insert or update or delete on public.partner_members
for each row execute function public.sync_home_service_reminder_members_trigger();

drop trigger if exists home_service_reminder_partner_sync on public.partners;
create trigger home_service_reminder_partner_sync
after update of status,partner_type on public.partners
for each row execute function public.sync_home_service_reminder_partner_trigger();

drop trigger if exists home_service_reminder_profile_sync on public.profiles;
create trigger home_service_reminder_profile_sync
after update of actif on public.profiles
for each row execute function public.sync_home_service_reminder_profile_trigger();

-- Le rendez-vous alimente immédiatement la file ; un changement de créneau
-- retire l'ancienne notification in-app et remet à zéro le cycle correspondant.
create or replace function public.sync_home_service_reminder_lifecycle()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare v_user_id uuid;
begin
  if new.status='confirmed' and new.scheduled_at is not null then
    if old.status is distinct from 'confirmed'
      or old.scheduled_at is distinct from new.scheduled_at then
      delete from public.notifications n
      using public.home_service_reminder_dispatches d
      where d.request_id=new.id
        and n.related_entity_id=d.id
        and n.user_id=d.recipient_id
        and n.type='home_service_appointment_reminder';

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

      for v_user_id in
        select pref.user_id
        from public.home_service_reminder_preferences pref
        where pref.partner_id=new.partner_id
      loop
        perform public.sync_home_service_reminder_user_scope(new.partner_id,v_user_id);
      end loop;
    end if;
  else
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
    where d.request_id=new.id and d.state in ('pending','processing');
  end if;
  return new;
end;
$function$;

revoke all on function public.sync_home_service_reminder_lifecycle() from public,anon,authenticated;

drop trigger if exists home_service_reminder_lifecycle_sync on public.home_service_requests;
create trigger home_service_reminder_lifecycle_sync
after update of status,scheduled_at on public.home_service_requests
for each row execute function public.sync_home_service_reminder_lifecycle();

-- Le claim réconcilie les changements de rôles, comptes, partenaire et préférences
-- avant l'envoi. Les lignes abandonnées au dernier essai deviennent terminales.
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
  update public.home_service_reminder_dispatches d
  set state='failed',locked_at=null,
      last_error='max_attempts_exhausted',updated_at=now()
  where d.attempts>=12
    and (
      d.state='pending'
      or (d.state='processing' and coalesce(d.locked_at,d.updated_at)<now()-interval '10 minutes')
    );

  update public.home_service_reminder_dispatches d
  set state='cancelled',locked_at=null,
      last_error='appointment_or_recipient_scope_no_longer_valid',updated_at=now()
  where d.state in ('pending','processing')
    and not exists (
      select 1
      from public.home_service_requests r
      join public.partners p on p.id=r.partner_id
      join public.partner_members pm on pm.partner_id=r.partner_id and pm.user_id=d.recipient_id
      join public.profiles pr on pr.id=pm.user_id
      join public.home_service_reminder_preferences pref
        on pref.partner_id=r.partner_id and pref.user_id=d.recipient_id
      where r.id=d.request_id
        and r.status='confirmed'
        and r.scheduled_at=d.scheduled_at
        and r.scheduled_at is not null
        and p.status='active'
        and p.partner_type='professionnel_domicile'
        and pm.member_role in ('owner','manager','operator')
        and pr.actif=true
        and pref.enabled=true
        and d.offset_minutes=any(pref.offsets_minutes)
    );

  return query
  with picked as (
    select d.id as dispatch_id
    from public.home_service_reminder_dispatches d
    join public.home_service_requests r on r.id=d.request_id
    join public.partners p on p.id=r.partner_id
    join public.partner_members pm on pm.partner_id=r.partner_id and pm.user_id=d.recipient_id
    join public.profiles pr on pr.id=pm.user_id
    join public.home_service_reminder_preferences pref
      on pref.partner_id=r.partner_id and pref.user_id=d.recipient_id
    where d.due_at<=now()
      and d.attempts<12
      and d.state in ('pending','processing')
      and r.status='confirmed'
      and r.scheduled_at is not null
      and r.scheduled_at=d.scheduled_at
      and p.status='active'
      and p.partner_type='professionnel_domicile'
      and pm.member_role in ('owner','manager','operator')
      and pr.actif=true
      and pref.enabled=true
      and d.offset_minutes=any(pref.offsets_minutes)
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

create or replace function public.claim_naxa_notification_push_outbox(p_batch_size integer default 500)
returns table(
  outbox_id uuid,
  recipient_id uuid,
  notification_type text,
  target_url text,
  attempts integer
)
language plpgsql
security definer
set search_path=''
as $function$
begin
  update public.naxa_notification_push_outbox o
  set state='failed',locked_at=null,
      last_error='max_attempts_exhausted',updated_at=now()
  where o.attempts>=12
    and (
      o.state='pending'
      or (o.state='processing' and coalesce(o.locked_at,o.updated_at)<now()-interval '10 minutes')
    );

  return query
  with picked as (
    select o.id as outbox_id
    from public.naxa_notification_push_outbox o
    where o.attempts<12
      and (
        o.state='pending'
        or (o.state='processing' and coalesce(o.locked_at,o.updated_at)<now()-interval '10 minutes')
      )
    order by o.created_at
    limit greatest(1,least(coalesce(p_batch_size,500),1000))
    for update skip locked
  ), claimed as (
    update public.naxa_notification_push_outbox o
    set state='processing',locked_at=now(),attempts=o.attempts+1,
        updated_at=now(),last_error=null
    from picked p
    where o.id=p.outbox_id
    returning o.id as outbox_id,o.recipient_id,o.notification_type,o.target_url,o.attempts
  )
  select c.outbox_id,c.recipient_id,c.notification_type,c.target_url,c.attempts
  from claimed c;
end;
$function$;

revoke all on function public.claim_naxa_notification_push_outbox(integer) from public,anon,authenticated;
grant execute on function public.claim_naxa_notification_push_outbox(integer) to service_role;

commit;
