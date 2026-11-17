begin;

create or replace function private.naxa_guard_partner_subscription_payment_state()
returns trigger
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_status text;
begin
  if new.status in ('pending','confirmed') then
    select s.status into v_status
    from public.partner_subscriptions s
    where s.partner_id=new.partner_id
    for update;
    if not found then raise exception 'Contrat d’abonnement partenaire introuvable'; end if;
    if v_status='cancelled' then
      raise exception 'Le contrat de cette structure est résilié ; une décision administrative distincte est requise';
    end if;
  end if;
  return new;
end;
$fn$;

revoke all on function private.naxa_guard_partner_subscription_payment_state() from public,anon,authenticated,service_role;
drop trigger if exists trg_guard_partner_subscription_payment_state on public.partner_subscription_payments;
create trigger trg_guard_partner_subscription_payment_state
before insert or update of status on public.partner_subscription_payments
for each row execute function private.naxa_guard_partner_subscription_payment_state();

commit;
