-- NAXA — distribution push unifiée de toutes les notifications métier vers les téléphones.
-- Les notifications restent créées par les transactions métier existantes.
-- Ce trigger ajoute une livraison push idempotente sans dupliquer leur logique métier.

begin;
create schema if not exists private;

create table if not exists private.notification_push_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','processing','sent','no_device','dead')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  constraint notification_push_outbox_recipient_uq unique(notification_id,recipient_user_id)
);
create index if not exists notification_push_outbox_pending_idx
  on private.notification_push_outbox(next_attempt_at,created_at)
  where status in ('pending','processing');
alter table private.notification_push_outbox enable row level security;
revoke all on private.notification_push_outbox from public,anon,authenticated,service_role;

create or replace function private.enqueue_notification_phone_push()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.user_id is not null then
    insert into private.notification_push_outbox(notification_id,recipient_user_id)
    values(new.id,new.user_id)
    on conflict(notification_id,recipient_user_id) do nothing;
  elsif new.pharmacie_id is not null then
    -- Les notifications destinées à une pharmacie sont distribuées aux titulaires
    -- d'affectations actives et au Promoteur explicitement rattaché à cette pharmacie.
    insert into private.notification_push_outbox(notification_id,recipient_user_id)
    select new.id,targets.user_id
    from (
      select a.profile_id as user_id
      from public.naxa_professional_assignments a
      join public.profiles p on p.id=a.profile_id and p.actif=true
      where a.pharmacie_id=new.pharmacie_id and a.statut='active'
        and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now())
      union
      select pp.promoteur_id
      from public.promoteur_pharmacies pp
      join public.profiles p on p.id=pp.promoteur_id and p.actif=true
      where pp.pharmacie_id=new.pharmacie_id and pp.actif=true
      union
      select p.id
      from public.profiles p
      where p.pharmacie_id=new.pharmacie_id and p.actif=true
        and p.role::text in ('pharmacie','caisse')
    ) targets
    where targets.user_id is not null
    on conflict(notification_id,recipient_user_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.enqueue_notification_phone_push() from public,anon,authenticated,service_role;
drop trigger if exists trg_enqueue_notification_phone_push on public.notifications;
create trigger trg_enqueue_notification_phone_push
after insert on public.notifications
for each row execute function private.enqueue_notification_phone_push();

create or replace function public.claim_notification_push_outbox(p_limit integer default 50)
returns table(outbox_id uuid,notification_id uuid,user_id uuid,title text,body text,attempt_count integer)
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_limit is null or p_limit<1 or p_limit>100 then
    raise exception 'Limite de traitement invalide';
  end if;
  -- Les comptes suspendus ne doivent plus recevoir de push et ne doivent pas
  -- rester éternellement bloqués dans la file.
  update private.notification_push_outbox o
  set status='dead',locked_at=null,last_error='Compte destinataire inactif'
  where o.status in ('pending','processing')
    and not exists (
      select 1 from public.profiles p
      where p.id=o.recipient_user_id and p.actif=true
    );

  return query
  with candidates as (
    select o.id
    from private.notification_push_outbox o
    where (o.status='pending' and o.next_attempt_at<=now())
       or (o.status='processing' and o.locked_at<now()-interval '5 minutes')
    order by o.created_at,o.id
    for update skip locked
    limit p_limit
  ), claimed as (
    update private.notification_push_outbox o
    set status='processing',locked_at=now(),attempt_count=o.attempt_count+1,last_error=null
    from candidates c where o.id=c.id
    returning o.id,o.notification_id,o.recipient_user_id,o.attempt_count
  )
  select c.id,n.id,c.recipient_user_id,n.titre,n.corps,c.attempt_count
  from claimed c join public.notifications n on n.id=c.notification_id
  join public.profiles p on p.id=c.recipient_user_id and p.actif=true;
end;
$$;

create or replace function public.finish_notification_push_outbox(
  p_outbox_id uuid,p_result text,p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
begin
  if p_result not in ('sent','no_device','retry') then
    raise exception 'Résultat de distribution invalide';
  end if;
  update private.notification_push_outbox
  set status=case
        when p_result='sent' then 'sent'
        when p_result='no_device' then 'no_device'
        when attempt_count>=8 then 'dead'
        else 'pending'
      end,
      sent_at=case when p_result='sent' then now() else null end,
      next_attempt_at=case
        when p_result<>'retry' or attempt_count>=8 then next_attempt_at
        else now()+make_interval(mins=>least(360,power(2,least(attempt_count,8))::integer))
      end,
      locked_at=null,
      last_error=case when p_result='retry' then left(coalesce(p_error,'Échec push'),1000) else null end
  where id=p_outbox_id and status='processing';
  return found;
end;
$$;
revoke all on function public.claim_notification_push_outbox(integer) from public,anon,authenticated;
revoke all on function public.finish_notification_push_outbox(uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_notification_push_outbox(integer) to service_role;
grant execute on function public.finish_notification_push_outbox(uuid,text,text) to service_role;

-- Réutilise le secret cron NAXA déjà stocké dans Vault et son vérificateur existant.
do $dispatch$
declare v_job_id bigint;
begin
  if not exists(select 1 from pg_extension where extname='pg_cron')
    or not exists(select 1 from pg_extension where extname='pg_net')
    or to_regprocedure('public.naxa_verify_posology_cron_secret(text)') is null
    or not exists(select 1 from vault.decrypted_secrets where name='naxa_posology_cron_secret') then
    return;
  end if;
  for v_job_id in select jobid from cron.job where jobname='naxa-notification-phone-push-every-minute'
  loop perform cron.unschedule(v_job_id); end loop;
  perform cron.schedule(
    'naxa-notification-phone-push-every-minute','* * * * *',
    'select net.http_get(
      url := ''https://nnaxa.vercel.app/api/cron/notifications/push'',
      params := ''{}''::jsonb,
      headers := jsonb_build_object(''Authorization'',''Bearer '' || (
        select decrypted_secret from vault.decrypted_secrets where name=''naxa_posology_cron_secret''
      )),
      timeout_milliseconds := 60000
    );'
  );
end;
$dispatch$;
commit;
