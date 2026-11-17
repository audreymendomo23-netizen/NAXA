-- NAXA — outbox e-mail universelle, additive et compatible avec l'outbox historique.
-- Cette migration ne modifie ni les règles métier ni les invitations existantes.
-- Les événements sont créés explicitement par les services autorisés; aucun envoi n'est déclenché ici.

create schema if not exists private;

create table if not exists private.email_delivery_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  event_type text not null check (event_type ~ '^[a-z][a-z0-9_.-]{2,95}$'),
  universe text not null check (universe in (
    'pharmacie','promoteur','parapharmacie','examens',
    'prestations_domicile','aide','livreur','client','admin','system'
  )),
  recipient_email text not null check (
    recipient_email = lower(trim(recipient_email))
    and length(recipient_email) between 6 and 254
    and recipient_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  recipient_user_id uuid,
  subject text not null check (length(trim(subject)) between 1 and 180),
  text_body text not null check (length(trim(text_body)) between 1 and 10000),
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','processing','sent','dead')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists email_delivery_outbox_pending_idx
  on private.email_delivery_outbox(next_attempt_at, created_at)
  where status = 'pending';
create index if not exists email_delivery_outbox_stale_idx
  on private.email_delivery_outbox(locked_at)
  where status = 'processing';

alter table private.email_delivery_outbox enable row level security;
revoke all on table private.email_delivery_outbox from public, anon, authenticated, service_role;

create or replace function public.enqueue_naxa_email_event(
  p_event_key text,
  p_event_type text,
  p_universe text,
  p_recipient_email text,
  p_subject text,
  p_text_body text,
  p_recipient_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_email text := lower(trim(coalesce(p_recipient_email,'')));
begin
  if p_event_key is null or p_event_key !~ '^[a-zA-Z0-9_.:-]{8,180}$'
     or p_event_type is null or p_event_type !~ '^[a-z][a-z0-9_.-]{2,95}$'
     or p_universe not in (
       'pharmacie','promoteur','parapharmacie','examens',
       'prestations_domicile','aide','livreur','client','admin','system'
     )
     or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or length(v_email) > 254
     or p_subject is null or length(trim(p_subject)) not between 1 and 180
     or p_text_body is null or length(trim(p_text_body)) not between 1 and 10000 then
    raise exception 'Événement e-mail NAXA invalide' using errcode = '22023';
  end if;

  insert into private.email_delivery_outbox(
    event_key,event_type,universe,recipient_email,recipient_user_id,
    subject,text_body,metadata
  )
  values(
    p_event_key,p_event_type,p_universe,v_email,p_recipient_user_id,
    trim(p_subject),p_text_body,coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict (event_key) do update
    set event_key = excluded.event_key
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.claim_naxa_email_events(p_limit integer default 25)
returns table (
  outbox_id uuid,
  event_key text,
  event_type text,
  universe text,
  recipient_email text,
  subject text,
  text_body text,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception 'Limite de traitement e-mail invalide';
  end if;

  return query
  with candidates as (
    select o.id
    from private.email_delivery_outbox o
    where (o.status = 'pending' and o.next_attempt_at <= now())
       or (o.status = 'processing' and o.locked_at < now() - interval '15 minutes')
    order by o.created_at, o.id
    for update skip locked
    limit p_limit
  ), claimed as (
    update private.email_delivery_outbox o
    set status = 'processing',
        locked_at = now(),
        attempt_count = o.attempt_count + 1,
        last_error = null
    from candidates c
    where o.id = c.id
    returning o.id,o.event_key,o.event_type,o.universe,o.recipient_email,
              o.subject,o.text_body,o.attempt_count
  )
  select c.id,c.event_key,c.event_type,c.universe,c.recipient_email,
         c.subject,c.text_body,c.attempt_count
  from claimed c;
end;
$$;

create or replace function public.finish_naxa_email_event(
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
begin
  update private.email_delivery_outbox
  set status = case
        when p_success then 'sent'
        when attempt_count >= 5 then 'dead'
        else 'pending'
      end,
      sent_at = case when p_success then now() else null end,
      provider_message_id = case when p_success then nullif(p_provider_message_id,'') else null end,
      last_error = case when p_success then null else left(coalesce(p_error,'Échec fournisseur'),1000) end,
      next_attempt_at = case
        when p_success or attempt_count >= 5 then next_attempt_at
        else now() + make_interval(mins => least(60,power(2,attempt_count)::integer))
      end,
      locked_at = null
  where id = p_outbox_id and status = 'processing';

  return found;
end;
$$;

revoke all on function public.enqueue_naxa_email_event(text,text,text,text,text,text,uuid,jsonb)
  from public,anon,authenticated;
revoke all on function public.claim_naxa_email_events(integer)
  from public,anon,authenticated;
revoke all on function public.finish_naxa_email_event(uuid,boolean,text,text)
  from public,anon,authenticated;

grant execute on function public.enqueue_naxa_email_event(text,text,text,text,text,text,uuid,jsonb)
  to service_role;
grant execute on function public.claim_naxa_email_events(integer)
  to service_role;
grant execute on function public.finish_naxa_email_event(uuid,boolean,text,text)
  to service_role;
