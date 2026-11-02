-- NAXA — outbox idempotente pour la délivrance des notifications e-mail Promoteur/Admin.
-- Migration canonique additive : aucune reprise/backfill des anciennes notifications n'est effectuée.

create schema if not exists private;

create table if not exists private.notification_email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null,
  channel text not null default 'email' check (channel = 'email'),
  status text not null default 'pending' check (status in ('pending','processing','sent','dead')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  constraint notification_email_outbox_notification_channel_uq unique(notification_id, channel)
);

alter table private.notification_email_outbox enable row level security;
revoke all on table private.notification_email_outbox from public, anon, authenticated, service_role;

create or replace function public.enqueue_notification_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null and new.type in (
    'abonnement_echeance_5j',
    'abonnement_echeance_5j_admin',
    'abonnement_reglement_a_verifier',
    'abonnement_reglement_soumis',
    'abonnement_reglement_confirme',
    'abonnement_reglement_refuse'
  ) then
    insert into private.notification_email_outbox(notification_id, user_id)
    values (new.id, new.user_id)
    on conflict (notification_id, channel) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.enqueue_notification_email() from public, anon, authenticated, service_role;

drop trigger if exists trg_enqueue_notification_email on public.notifications;
create trigger trg_enqueue_notification_email
after insert on public.notifications
for each row execute function public.enqueue_notification_email();

create or replace function public.claim_notification_email_outbox(p_limit integer default 25)
returns table (
  outbox_id uuid,
  notification_id uuid,
  user_id uuid,
  email text,
  title text,
  body text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Limite de traitement invalide';
  end if;

  return query
  with candidates as (
    select o.id
    from private.notification_email_outbox o
    where (o.status = 'pending' and o.next_attempt_at <= now())
       or (o.status = 'processing' and o.locked_at < now() - interval '15 minutes')
    order by o.created_at, o.id
    for update skip locked
    limit p_limit
  ), claimed as (
    update private.notification_email_outbox o
    set status = 'processing',
        locked_at = now(),
        attempt_count = o.attempt_count + 1,
        last_error = null
    from candidates c
    where o.id = c.id
    returning o.id, o.notification_id, o.user_id, o.attempt_count
  )
  select c.id, n.id, c.user_id, u.email::text, n.titre, n.corps, c.attempt_count
  from claimed c
  join public.notifications n on n.id = c.notification_id
  left join auth.users u on u.id = c.user_id;
end;
$$;

create or replace function public.finish_notification_email_outbox(
  p_outbox_id uuid,
  p_success boolean,
  p_provider_message_id text default null,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt integer;
begin
  update private.notification_email_outbox
  set status = case
        when p_success then 'sent'
        when attempt_count >= 5 then 'dead'
        else 'pending'
      end,
      sent_at = case when p_success then now() else null end,
      provider_message_id = case when p_success then nullif(p_provider_message_id, '') else null end,
      last_error = case when p_success then null else left(coalesce(p_error, 'Échec fournisseur'), 1000) end,
      next_attempt_at = case
        when p_success or attempt_count >= 5 then next_attempt_at
        else now() + make_interval(mins => least(60, power(2, attempt_count)::integer))
      end,
      locked_at = null
  where id = p_outbox_id and status = 'processing'
  returning attempt_count into v_attempt;

  return found;
end;
$$;

revoke all on function public.claim_notification_email_outbox(integer) from public, anon, authenticated;
revoke all on function public.finish_notification_email_outbox(uuid, boolean, text, text) from public, anon, authenticated;
grant execute on function public.claim_notification_email_outbox(integer) to service_role;
grant execute on function public.finish_notification_email_outbox(uuid, boolean, text, text) to service_role;
