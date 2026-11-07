-- Keep historical settlements while enforcing the new nationwide price band for new rows.
begin;

alter table public.naxa_delivery_commission_ledger
  drop constraint if exists naxa_delivery_commission_ledger_frais_livraison_client_check,
  drop constraint if exists naxa_delivery_commission_ledger_solde_livraison_check;

alter table public.naxa_delivery_commission_ledger
  add constraint naxa_delivery_commission_ledger_frais_livraison_client_check
    check (frais_livraison_client between 1000 and 3000) not valid,
  add constraint naxa_delivery_commission_ledger_solde_livraison_check
    check (solde_livraison >= 500) not valid;

comment on constraint naxa_delivery_commission_ledger_frais_livraison_client_check
  on public.naxa_delivery_commission_ledger is
  'New delivery commissions are 1 000–3 000 FCFA; pre-existing immutable ledger entries remain historically valid.';
comment on constraint naxa_delivery_commission_ledger_solde_livraison_check
  on public.naxa_delivery_commission_ledger is
  'The retained delivery balance after the fixed 500 FCFA platform commission is at least 500 FCFA for new entries.';

commit;
