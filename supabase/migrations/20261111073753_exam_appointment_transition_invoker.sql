-- NAXA — transition rendez-vous Examens en SECURITY INVOKER.
-- Les droits passent par RLS; le trigger conserve l'atomicité de l'annulation et l'audit.
begin;

grant update on public.exam_appointments to authenticated;
grant update on public.exam_slots to authenticated;

drop policy if exists exam_appointments_staff_update on public.exam_appointments;
create policy exam_appointments_staff_update on public.exam_appointments
for update to authenticated
using (private.exam_has_capability(center_id,'appointments_manage'))
with check (private.exam_has_capability(center_id,'appointments_manage'));

drop policy if exists exam_slots_staff_manage_read on public.exam_slots;
create policy exam_slots_staff_manage_read on public.exam_slots
for select to authenticated
using (private.exam_has_capability(center_id,'appointments_manage'));

drop policy if exists exam_slots_staff_update on public.exam_slots;
create policy exam_slots_staff_update on public.exam_slots
for update to authenticated
using (private.exam_has_capability(center_id,'appointments_manage'))
with check (private.exam_has_capability(center_id,'appointments_manage'));

create or replace function private.exam_guard_appointment_update()
returns trigger
language plpgsql
set search_path=''
as $function$
declare v_allowed boolean:=false;
begin
  if new.id is distinct from old.id
    or new.client_id is distinct from old.client_id
    or new.center_id is distinct from old.center_id
    or new.slot_id is distinct from old.slot_id
    or new.service_id is distinct from old.service_id
    or new.pack_id is distinct from old.pack_id
    or new.item_name is distinct from old.item_name
    or new.price_fcfa is distinct from old.price_fcfa
    or new.ticket_code is distinct from old.ticket_code
    or new.created_at is distinct from old.created_at
    or new.reminder_at is distinct from old.reminder_at
    or new.client_note is distinct from old.client_note then
    raise exception 'Le rattachement et les données tarifaires du ticket sont immuables' using errcode='42501';
  end if;

  if not private.exam_has_capability(old.center_id,'appointments_manage') then
    raise exception 'Droit de gestion des rendez-vous requis' using errcode='42501';
  end if;

  v_allowed :=
    (old.status='booked' and new.status in ('confirmed','cancelled'))
    or (old.status='confirmed' and new.status in ('completed','cancelled'));

  if not v_allowed then
    raise exception 'Transition impossible depuis le statut %',old.status using errcode='23514';
  end if;

  if new.status='cancelled' then
    update public.exam_slots
      set reserved_count=reserved_count-1
      where id=old.slot_id and center_id=old.center_id and reserved_count>0;
    if not found then
      raise exception 'Compteur de places incohérent; annulation interrompue' using errcode='23514';
    end if;
  end if;

  new.updated_at:=now();
  return new;
end;
$function$;

drop trigger if exists exam_appointment_transition_guard on public.exam_appointments;
create trigger exam_appointment_transition_guard
before update on public.exam_appointments
for each row execute function private.exam_guard_appointment_update();

create or replace function private.exam_log_appointment_transition()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if old.status is distinct from new.status then
    insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(
      auth.uid(),
      'exam_appointment_status_changed',
      'exam_appointment',
      new.id::text,
      jsonb_build_object(
        'center_id',new.center_id,
        'ticket_code',new.ticket_code,
        'from_status',old.status,
        'to_status',new.status
      )
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists exam_appointment_transition_audit on public.exam_appointments;
create trigger exam_appointment_transition_audit
after update of status on public.exam_appointments
for each row execute function private.exam_log_appointment_transition();

create or replace function public.transition_exam_appointment(p_appointment_id uuid,p_next_status text)
returns text
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_appointment public.exam_appointments%rowtype;
begin
  if v_user is null then raise exception 'Connexion requise' using errcode='28000'; end if;
  if p_appointment_id is null or p_next_status not in ('confirmed','completed','cancelled') then
    raise exception 'Transition invalide' using errcode='22023';
  end if;
  select a.* into v_appointment
  from public.exam_appointments a
  where a.id=p_appointment_id
  for update;
  if not found then raise exception 'Réservation introuvable ou inaccessible' using errcode='P0002'; end if;
  if not private.exam_has_capability(v_appointment.center_id,'appointments_manage') then
    raise exception 'Droit de gestion des rendez-vous requis' using errcode='42501';
  end if;
  update public.exam_appointments
    set status=p_next_status
    where id=p_appointment_id and center_id=v_appointment.center_id;
  if not found then raise exception 'Transition refusée par les politiques de sécurité' using errcode='42501'; end if;
  return p_next_status;
end;
$function$;

revoke all on function public.transition_exam_appointment(uuid,text) from public,anon;
grant execute on function public.transition_exam_appointment(uuid,text) to authenticated;

commit;
