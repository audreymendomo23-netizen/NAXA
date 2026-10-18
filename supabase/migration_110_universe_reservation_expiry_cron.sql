-- NAXA 110 — automatiser l'expiration des réservations Parapharmacie et Bébé & Maman.
-- Additif : le job ne touche qu'à public.universe_reservations, jamais aux réservations Pharmacie.
-- À appliquer d'abord en environnement de test après validation des migrations 098 à 109.
begin;

create or replace function public.expire_universe_reservations_cron(p_limit integer default 500)
returns integer
language plpgsql
security definer
set search_path=public
as $function$
declare
  changed integer;
begin
  if p_limit is null or p_limit < 1 or p_limit > 5000 then
    raise exception 'Limite invalide';
  end if;

  with due as (
    select id
    from public.universe_reservations
    where status in ('requested','confirmed','ready')
      and expires_at <= now()
    order by expires_at
    for update skip locked
    limit p_limit
  )
  update public.universe_reservations r
    set status='expired', updated_at=now()
    from due
    where r.id=due.id;
  get diagnostics changed = row_count;

  if changed > 0 then
    insert into public.audit_log(actor_id,action,entity_type,metadata)
    values(null,'reservations.expired.cron_batch','universe_reservation_batch',
      jsonb_build_object('count',changed,'processed_at',now()));
  end if;
  return changed;
end;
$function$;

-- Le job cron s'exécute comme le rôle qui le programme (normalement postgres).
-- La fonction n'est exécutable ni par les comptes clients, ni par les partenaires.
revoke all on function public.expire_universe_reservations_cron(integer) from public, anon, authenticated, service_role;

do $schedule$
declare
  existing_job_id bigint;
begin
  if not exists (select 1 from pg_extension where extname='pg_cron') then
    raise exception 'Activez pg_cron avant d’appliquer la migration 110';
  end if;

  select jobid into existing_job_id
  from cron.job
  where jobname='naxa-expire-universe-reservations'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'naxa-expire-universe-reservations',
    '*/5 * * * *',
    'select public.expire_universe_reservations_cron(500);'
  );
end;
$schedule$;

commit;
