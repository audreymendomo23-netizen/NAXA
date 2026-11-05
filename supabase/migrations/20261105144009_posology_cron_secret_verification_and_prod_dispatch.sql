-- NAXA — authentification dédiée du worker Web Push et dispatch Production stable.
-- Le jeton n'est jamais retourné par la fonction : seul un booléen est exposé au
-- worker service_role. Le secret reste dans Supabase Vault.
-- Cette migration retargete le job existant uniquement si le secret Vault requis existe.

begin;

create or replace function public.naxa_verify_posology_cron_secret(p_candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    p_candidate is not null
    and char_length(p_candidate) >= 32
    and exists (
      select 1
      from vault.decrypted_secrets
      where name = 'naxa_posology_cron_secret'
        and decrypted_secret = p_candidate
    ),
    false
  );
$function$;

revoke all on function public.naxa_verify_posology_cron_secret(text)
  from public, anon, authenticated;
grant execute on function public.naxa_verify_posology_cron_secret(text)
  to service_role;

comment on function public.naxa_verify_posology_cron_secret(text) is
  'Vérifie le jeton dédié du dispatcher Web Push contre Supabase Vault sans jamais exposer le secret. Exécutable uniquement par service_role.';

do $dispatch$
declare
  v_job_id bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     or not exists (select 1 from pg_extension where extname = 'pg_net')
     or not exists (
       select 1 from vault.decrypted_secrets
       where name = 'naxa_posology_cron_secret'
     ) then
    return;
  end if;

  for v_job_id in
    select jobid
    from cron.job
    where jobname = 'naxa-posology-web-push-every-five-minutes'
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'naxa-posology-web-push-every-five-minutes',
    '*/5 * * * *',
    'select net.http_get(
      url := ''https://nnaxa.vercel.app/api/cron/posologie'',
      params := ''{}''::jsonb,
      headers := jsonb_build_object(
        ''Authorization'',
        ''Bearer '' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = ''naxa_posology_cron_secret''
        )
      ),
      timeout_milliseconds := 60000
    );'
  );
end;
$dispatch$;

notify pgrst, 'reload schema';

commit;
