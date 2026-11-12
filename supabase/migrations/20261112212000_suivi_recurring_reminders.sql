-- NAXA — cycle récurrent des rappels personnels.
begin;

alter table public.suivi_reminders
  add column if not exists last_notified_due_at timestamptz;

create index if not exists suivi_reminders_due_unnotified_idx
  on public.suivi_reminders(due_at,user_id)
  where enabled=true;

commit;
