-- NAXA — supprimer les rappels in-app devenus obsolètes.
-- Les notifications déjà transmises aux appareils ne peuvent pas être rappelées,
-- mais les entrées encore présentes dans le centre NAXA suivent le cycle de vie.
begin;

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
    delete from public.notifications n
    using public.home_service_reminder_dispatches d, public.home_service_requests r
    where r.id=d.request_id and r.partner_id=p_partner_id
      and d.recipient_id=p_user_id
      and n.related_entity_id=d.id and n.user_id=d.recipient_id
      and n.type='home_service_appointment_reminder';
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
    delete from public.notifications n
    using public.home_service_reminder_dispatches d, public.home_service_requests r
    where r.id=d.request_id and r.partner_id=p_partner_id
      and d.recipient_id=p_user_id
      and n.related_entity_id=d.id and n.user_id=d.recipient_id
      and n.type='home_service_appointment_reminder';
    update public.home_service_reminder_dispatches d
    set state='cancelled',locked_at=null,
        last_error='reminders_disabled',updated_at=now()
    from public.home_service_requests r
    where r.id=d.request_id and r.partner_id=p_partner_id
      and d.recipient_id=p_user_id and d.state in ('pending','processing');
    return;
  end if;

  delete from public.notifications n
  using public.home_service_reminder_dispatches d, public.home_service_requests r
  where r.id=d.request_id and r.partner_id=p_partner_id
    and d.recipient_id=p_user_id
    and not (d.offset_minutes = any(v_offsets))
    and n.related_entity_id=d.id and n.user_id=d.recipient_id
    and n.type='home_service_appointment_reminder';

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
    delete from public.notifications n
    using public.home_service_reminder_dispatches d
    where d.request_id=new.id
      and n.related_entity_id=d.id
      and n.user_id=d.recipient_id
      and n.type='home_service_appointment_reminder';

    update public.home_service_reminder_dispatches d
    set state='cancelled',  else
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

commit;
