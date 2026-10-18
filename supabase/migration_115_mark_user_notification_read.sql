-- NAXA 115 — permettre au destinataire de marquer sa notification comme lue.
begin;

create or replace function public.mark_user_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  uid uuid := auth.uid();
  changed integer;
begin
  if uid is null then
    raise exception 'Connexion requise' using errcode = '28000';
  end if;
  if p_notification_id is null then
    raise exception 'Notification invalide' using errcode = '22023';
  end if;

  update public.notifications
  set lu_le = now()
  where id = p_notification_id
    and user_id = uid
    and lu_le is null;
  get diagnostics changed = row_count;
  return changed > 0 or exists (
    select 1 from public.notifications
    where id = p_notification_id and user_id = uid and lu_le is not null
  );
end;
$function$;

revoke all on function public.mark_user_notification_read(uuid) from public, anon;
grant execute on function public.mark_user_notification_read(uuid) to authenticated;

commit;
