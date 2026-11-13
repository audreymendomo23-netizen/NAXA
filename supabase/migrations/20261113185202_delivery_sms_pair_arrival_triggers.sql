begin;

create or replace function private.naxa_match_delivery_sms_on_arrival()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_table_schema <> 'public' then
    return new;
  end if;

  if tg_table_name = 'naxa_delivery_payment_records' then
    if new.status = 'declared'
       and new.mode in ('mtn_marchand','orange_money')
       and new.reference is not null
       and length(upper(regexp_replace(trim(new.reference), '[^A-Za-z0-9]', '', 'g'))) between 5 and 120 then
      perform public.naxa_match_delivery_payment_sms(new.pharmacie_id, new.reference);
    end if;
    return new;
  end if;

  if tg_table_name = 'naxa_payment_evidence_intake' then
    if new.workspace_type = 'pharmacie'
       and new.source_type = 'sms_receiver'
       and new.direction = 'merchant_credit'
       and new.success is true
       and new.transaction_reference is not null
       and length(upper(regexp_replace(trim(new.transaction_reference), '[^A-Za-z0-9]', '', 'g'))) between 5 and 120 then
      perform public.naxa_match_delivery_payment_sms(new.workspace_id, new.transaction_reference);
    end if;
    return new;
  end if;

  return new;
end;
$function$;

revoke all on function private.naxa_match_delivery_sms_on_arrival() from public, anon, authenticated;
grant execute on function private.naxa_match_delivery_sms_on_arrival() to service_role;

drop trigger if exists trg_naxa_delivery_payment_match_after_declaration
  on public.naxa_delivery_payment_records;
create trigger trg_naxa_delivery_payment_match_after_declaration
after insert or update of reference, status
on public.naxa_delivery_payment_records
for each row
execute function private.naxa_match_delivery_sms_on_arrival();

drop trigger if exists trg_naxa_payment_evidence_match_after_credit
  on public.naxa_payment_evidence_intake;
create trigger trg_naxa_payment_evidence_match_after_credit
after insert
on public.naxa_payment_evidence_intake
for each row
execute function private.naxa_match_delivery_sms_on_arrival();

comment on function private.naxa_match_delivery_sms_on_arrival() is
  'Rapproche les SMS debit/credit Client-Pharmacie des que chaque cote arrive; le libelle expediteur ne participe pas a la decision. Une paire coherente reste matched_waiting_pos jusqu a son inscription dans la Caisse.';

commit;
