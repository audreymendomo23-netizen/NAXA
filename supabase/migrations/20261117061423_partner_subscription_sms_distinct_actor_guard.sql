create or replace function private.naxa_guard_partner_subscription_paired_sms_actors()
returns trigger
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_payer_user uuid;
  v_event_admin uuid;
begin
  if new.status='confirmed' and new.confirmation_source='paired_sms' then
    select c.user_id into v_payer_user
    from public.naxa_partner_payment_notification_candidates c
    where c.id=new.payer_candidate_id;
    select e.admin_id into v_event_admin
    from public.naxa_admin_payment_capture_events e
    where e.id=new.merchant_capture_event_id;

    if v_payer_user is null or v_event_admin is null
      or v_payer_user=new.confirmed_by
      or v_event_admin is distinct from new.confirmed_by then
      raise exception 'Les preuves SMS doivent provenir de deux appareils et acteurs distincts';
    end if;
  end if;
  return new;
end;
$fn$;

revoke all on function private.naxa_guard_partner_subscription_paired_sms_actors()
  from public,anon,authenticated,service_role;
drop trigger if exists trg_partner_subscription_paired_sms_actor_guard
  on public.partner_subscription_payments;
create trigger trg_partner_subscription_paired_sms_actor_guard
before insert or update of status,confirmation_source on public.partner_subscription_payments
for each row execute function private.naxa_guard_partner_subscription_paired_sms_actors();
