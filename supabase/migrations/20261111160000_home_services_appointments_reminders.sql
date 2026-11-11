-- NAXA — rendez-vous confirmés et rappels professionnels Prestations.
-- Additif : réutilise le dispatcher Web Push existant (cron posologie) et public.notifications.
begin;

alter table public.home_service_requests
  add column if not exists scheduled_at timestamptz;

create index if not exists home_service_requests_scheduled_idx
  on public.home_service_requests(partner_id,scheduled_at)
  where status='confirmed' and scheduled_at is not null;

create table if not exists public.home_service_reminder_preferences (
  partner_id uuid not null references public.partners(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  offsets_minutes integer[] not null default array[1440,120,30]::integer[],
  timezone text not null default 'Africa/Douala',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(partner_id,user_id),
  constraint home_service_reminder_offsets_count_ck
    check (cardinality(offsets_minutes) between 1 and 6),
  constraint home_service_reminder_offsets_allowed_ck
    check (offsets_minutes <@ array[0,15,30,60,120,1440]::integer[]),
  constraint home_service_reminder_timezone_ck
    check (timezone in ('Africa/Douala'))
);

create table if not exists public.home_service_reminder_dispatches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.home_service_requests(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  offset_minutes integer not null check (offset_minutes in (0,15,30,60,120,1440)),
  scheduled_at timestamptz not null,
  due_at timestamptz not null,
  notification_created_at timestamptz,
  state text not null default 'pending' check (state in ('pending','processing','sent')),
  locked_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(request_id,recipient_id,offset_minutes)
);

create index if not exists home_service_reminder_dispatches_due_idx
  on public.home_service_reminder_dispatches(due_at)
  where state in ('pending','processing');

alter table public.home_service_reminder_preferences enable row level security;
alter table public.home_service_reminder_dispatches enable row level security;

drop policy if exists home_service_reminder_preferences_read on public.home_service_reminder_preferences;
create policy home_service_reminder_preferences_read
on public.home_service_reminder_preferences for select to authenticated
using (
  user_id=(select auth.uid())
  and exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
    join public.profiles pr on pr.id=pm.user_id and pr.actif=true
    where pm.partner_id=home_service_reminder_preferences.partner_id
      and pm.user_id=(select auth.uid())
      and pm.member_role in ('owner','manager','operator')
      and pa.status='active'
      and pa.partner_type='professionnel_domicile'
  )
);

drop policy if exists home_service_reminder_preferences_insert on public.home_service_reminder_preferences;
create policy home_service_reminder_preferences_insert
on public.home_service_reminder_preferences for insert to authenticated
with check (
  user_id=(select auth.uid())
  and exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
    join public.profiles pr on pr.id=pm.user_id and pr.actif=true
    where pm.partner_id=home_service_reminder_preferences.partner_id
      and pm.user_id=(select auth.uid())
      and pm.member_role in ('owner','manager','operator')
      and pa.status='active'
      and pa.partner_type='professionnel_domicile'
  )
);

drop policy if exists home_service_reminder_preferences_update on public.home_service_reminder_preferences;
create policy home_service_reminder_preferences_update
on public.home_service_reminder_preferences for update to authenticated
using (
  user_id=(select auth.uid())
  and exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
    join public.profiles pr on pr.id=pm.user_id and pr.actif=true
    where pm.partner_id=home_service_reminder_preferences.partner_id
      and pm.user_id=(select auth.uid())
      and pm.member_role in ('owner','manager','operator')
      and pa.status='active'
      and pa.partner_type='professionnel_domicile'
  )
)
with check (
  user_id=(select auth.uid())
  and exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
    join public.profiles pr on pr.id=pm.user_id and pr.actif=true
    where pm.partner_id=home_service_reminder_preferences.partner_id
      and pm.user_id=(select auth.uid())
      and pm.member_role in ('owner','manager','operator')
      and pa.status='active'
      and pa.partner_type='professionnel_domicile'
  )
);

drop policy if exists home_service_reminder_preferences_delete on public.home_service_reminder_preferences;
create policy home_service_reminder_preferences_delete
on public.home_service_reminder_preferences for delete to authenticated
using (
  user_id=(select auth.uid())
  and exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
    join public.profiles pr on pr.id=pm.user_id and pr.actif=true
    where pm.partner_id=home_service_reminder_preferences.partner_id
      and pm.user_id=(select auth.uid())
      and pm.member_role in ('owner','manager','operator')
      and pa.status='active'
      and pa.partner_type='professionnel_domicile'
  )
);

revoke all on public.home_service_reminder_preferences from public,anon;
grant select,insert,update,delete on public.home_service_reminder_preferences to authenticated;
revoke all on public.home_service_reminder_dispatches from public,anon,authenticated;
grant all on public.home_service_reminder_dispatches to service_role;

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
    where d.due_at<=now() and d.attempts<12
      and (
        d.state='pending'
        or (d.state='processing' and coalesce(d.locked_at,d.updated_at)<now()-interval '10 minutes')
      )
    order by d.due_at
    limit greatest(1,least(coalesce(p_batch_size,500),1000))
    for update skip locked
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

-- La confirmation devient une véritable prise de rendez-vous : le professionnel
-- choisit explicitement le créneau retenu, distinct de la préférence du client.
create or replace function public.confirm_home_service_appointment(
  p_request_id uuid,
  p_scheduled_at timestamptz
) returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_request public.home_service_requests%rowtype;
  v_is_admin boolean;
  v_can_manage boolean;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if p_request_id is null or p_scheduled_at is null
    or p_scheduled_at < now()+interval '5 minutes'
    or p_scheduled_at > now()+interval '180 days' then
    raise exception 'Choisissez un créneau futur, compris entre 5 minutes et 180 jours';
  end if;

  select * into v_request
  from public.home_service_requests
  where id=p_request_id
  for update;
  if not found then raise exception 'Demande introuvable'; end if;
  if v_request.status<>'requested' then
    raise exception 'Cette demande ne peut plus être confirmée';
  end if;

  v_is_admin:=public.is_admin();
  select exists (
    select 1
    from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
    join public.profiles pr on pr.id=pm.user_id and pr.actif=true
    where pm.partner_id=v_request.partner_id
      and pm.user_id=v_uid
      and pm.member_role in ('owner','manager','operator')
      and pa.status='active'
      and pa.partner_type='professionnel_domicile'
  ) into v_can_manage;

  if not (v_is_admin or v_can_manage) then
    raise exception 'Action non autorisée' using errcode='42501';
  end if;

  update public.home_service_requests
  set status='confirmed',scheduled_at=p_scheduled_at,confirmed_at=now(),updated_at=now()
  where id=v_request.id and status='requested';
  if not found then raise exception 'La demande a été modifiée simultanément'; end if;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'home_service.appointment_confirmed','home_service_request',v_request.id::text,
    jsonb_build_object('partner_id',v_request.partner_id,'scheduled_at',p_scheduled_at));
end;
$function$;

revoke all on function public.confirm_home_service_appointment(uuid,timestamptz) from public,anon;
grant execute on function public.confirm_home_service_appointment(uuid,timestamptz) to authenticated;

-- Interdire l'ancien raccourci de confirmation sans créneau horodaté.
create or replace function public.transition_home_service_request(p_request_id uuid,p_status text)
returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_request public.home_service_requests%rowtype;
  v_is_admin boolean;
  v_can_manage boolean;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select * into v_request from public.home_service_requests where id=p_request_id for update;
  if not found then raise exception 'Demande introuvable'; end if;

  v_is_admin:=public.is_admin();
  select exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
    join public.profiles pr on pr.id=pm.user_id and pr.actif=true
    where pm.partner_id=v_request.partner_id and pm.user_id=v_uid
      and pm.member_role in ('owner','manager','operator')
      and pa.status='active' and pa.partner_type='professionnel_domicile'
  ) into v_can_manage;

  if p_status='cancelled' and v_request.client_id=v_uid
    and v_request.status in ('requested','confirmed') then
    update public.home_service_requests set status='cancelled',updated_at=now()
      where id=v_request.id;
    insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(v_uid,'home_service.cancelled','home_service_request',v_request.id::text,'{"by":"client"}'::jsonb);
    return;
  end if;

  if not (v_is_admin or v_can_manage) then
    raise exception 'Action non autorisée' using errcode='42501';
  end if;
  if p_status='confirmed' then
    raise exception 'Utilisez confirm_home_service_appointment pour confirmer avec un créneau';
  end if;
  if v_request.status in ('completed','cancelled','expired') then
    raise exception 'Demande déjà clôturée';
  end if;
  if p_status='completed' and v_request.status='confirmed' then
    update public.home_service_requests set status='completed',completed_at=now(),updated_at=now()
      where id=v_request.id;
  else
    raise exception 'Transition de statut non autorisée';
  end if;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_uid,'home_service.'||p_status,'home_service_request',v_request.id::text,
    jsonb_build_object('partner_id',v_request.partner_id));
end;
$function$;

revoke all on function public.transition_home_service_request(uuid,text) from public,anon;
grant execute on function public.transition_home_service_request(uuid,text) to authenticated;


-- File d'attente centrale : toute notification applicative devient éligible au Push.
-- Les messages avec fil_id sont exclus ici car leur flux Push dédié existe déjà.
create table if not exists public.naxa_notification_push_outbox (
  id uuid primary key default gen_random_uuid(),
  source_notification_id text not null,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null check (length(trim(title)) between 1 and 160),
  body text not null check (length(body) <= 1000),
  target_url text not null default '/notifications',
  state text not null default 'pending' check (state in ('pending','processing','sent')),
  locked_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_notification_id,recipient_id)
);

create index if not exists naxa_notification_push_outbox_pending_idx
  on public.naxa_notification_push_outbox(created_at)
  where state in ('pending','processing');

alter table public.naxa_notification_push_outbox enable row level security;
revoke all on public.naxa_notification_push_outbox from public,anon,authenticated;
grant all on public.naxa_notification_push_outbox to service_role;

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

create or replace function public.enqueue_naxa_notification_push()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_source_id text:=coalesce(to_jsonb(new)->>'id',gen_random_uuid()::text);
  v_target text:='/notifications';
  v_recipients uuid[];
  v_recipient uuid;
begin
  -- Messages : le endpoint de messagerie envoie déjà un Push contextualisé.
  if new.fil_id is not null or new.type='message' then return new; end if;
  -- Les rappels de rendez-vous sont envoyés par le sous-flux dédié du même cron.
  if new.type='home_service_appointment_reminder' then return new; end if;

  v_target:=case
    when new.type like 'abonnement_%' then '/promoteur/paiements'
    when new.type='home_service_offer' and exists (select 1 from public.profiles p where p.id=new.user_id and p.role='admin') then '/admin/prestations'
    when new.type like 'home_service_%' then '/partenaire/prestations'
    when new.type like 'reservation%' then '/notifications'
    when new.type like 'suivi_%' then '/suivi'
    else '/notifications'
  end;

  if new.user_id is not null then
    select coalesce(array_agg(p.id),array[]::uuid[])
    into v_recipients
    from public.profiles p
    where p.id=new.user_id and p.actif=true;
  elsif new.pharmacie_id is not null then
    select coalesce(array_agg(p.id),array[]::uuid[])
    into v_recipients
    from public.profiles p
    where p.pharmacie_id=new.pharmacie_id and p.actif=true;
  else
    return new;
  end if;

  foreach v_recipient in array v_recipients loop
    insert into public.naxa_notification_push_outbox(
      source_notification_id,recipient_id,notification_type,title,body,target_url
    ) values (
      v_source_id,v_recipient,new.type,new.titre,new.corps,v_target
    )
    on conflict(source_notification_id,recipient_id) do nothing;
  end loop;
  return new;
end;
$function$;

drop trigger if exists naxa_notification_push_enqueue on public.notifications;
create trigger naxa_notification_push_enqueue
after insert on public.notifications
for each row execute function public.enqueue_naxa_notification_push();

revoke all on function public.enqueue_naxa_notification_push() from public,anon,authenticated;

commit;
