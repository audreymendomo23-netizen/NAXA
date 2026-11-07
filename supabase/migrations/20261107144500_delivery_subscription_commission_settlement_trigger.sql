begin;

create or replace function private.naxa_delivery_sync_subscription_commission_settlement()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_base integer;
  v_month_count integer;
  v_commission_due integer;
  v_base_due integer;
  v_from date;
  v_to date;
begin
  if new.abonnement_id is null or new.pharmacie_id is null
    or new.periode_du is null or new.periode_au is null
    or new.periode_au<new.periode_du then
    return new;
  end if;

  select a.montant_mensuel into v_base
  from public.abonnements a
  where a.id=new.abonnement_id and a.pharmacie_id=new.pharmacie_id;
  if not found or v_base is null or v_base<0 then return new; end if;

  v_from:=date_trunc('month',new.periode_du)::date;
  v_to:=date_trunc('month',new.periode_au)::date;
  v_month_count:=(extract(year from v_to)-extract(year from v_from))*12
    +(extract(month from v_to)-extract(month from v_from))+1;
  if v_month_count<1 or v_month_count>24 then return new; end if;
  v_base_due:=v_base*v_month_count;

  select coalesce(sum(l.commission_naxa),0)::integer into v_commission_due
  from public.naxa_delivery_commission_ledger l
  where l.pharmacie_id=new.pharmacie_id
    and l.settlement_month between v_from and v_to
    and l.regle_le is null;

  -- Mark only if the recorded subscription payment covers BOTH the base
  -- licence and every accrued delivery commission for the covered period.
  if v_commission_due>0 and new.montant>=v_base_due+v_commission_due then
    update public.naxa_delivery_commission_ledger l
    set regle_le=coalesce(l.regle_le,new.paye_le,now()),
        reference_reglement=coalesce(nullif(trim(new.reference),''),l.reference_reglement)
    where l.pharmacie_id=new.pharmacie_id
      and l.settlement_month between v_from and v_to
      and l.regle_le is null;
  end if;
  return new;
end;
$function$;

revoke all on function private.naxa_delivery_sync_subscription_commission_settlement() from public,anon,authenticated;

drop trigger if exists trg_naxa_delivery_commission_monthly_settlement on public.abonnement_paiements;
create trigger trg_naxa_delivery_commission_monthly_settlement
after insert on public.abonnement_paiements
for each row execute function private.naxa_delivery_sync_subscription_commission_settlement();

commit;
