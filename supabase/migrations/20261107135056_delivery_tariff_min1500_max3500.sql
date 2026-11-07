-- NAXA — Tarifs nationaux : 1 500 FCFA jusqu'à 2,5 km, puis 100 FCFA/km supplémentaire.
-- La commission NAXA reste fixe à 500 FCFA, incluse dans le prix client.
-- NOT VALID préserve les écritures historiques ; les nouvelles écritures sont contrôlées.
begin;

alter table public.naxa_delivery_quotes
  drop constraint if exists naxa_delivery_quotes_frais_livraison_check;

alter table public.naxa_delivery_quotes
  add constraint naxa_delivery_quotes_frais_livraison_check
    check (frais_livraison between 1500 and 3500) not valid;

alter table public.naxa_delivery_commission_ledger
  drop constraint if exists naxa_delivery_commission_ledger_frais_livraison_client_check,
  drop constraint if exists naxa_delivery_commission_ledger_solde_livraison_check;

alter table public.naxa_delivery_commission_ledger
  add constraint naxa_delivery_commission_ledger_frais_livraison_client_check
    check (frais_livraison_client between 1500 and 3500) not valid,
  add constraint naxa_delivery_commission_ledger_solde_livraison_check
    check (solde_livraison >= 1000) not valid;

comment on constraint naxa_delivery_quotes_frais_livraison_check
  on public.naxa_delivery_quotes is
  'Devis client entre 1 500 et 3 500 FCFA ; tarif calculé côté serveur à partir du trajet routier.';

comment on constraint naxa_delivery_commission_ledger_commission_naxa_check
  on public.naxa_delivery_commission_ledger is
  'Commission NAXA fixe à 500 FCFA par livraison ; comprise dans les frais facturés au client.';

comment on constraint naxa_delivery_commission_ledger_frais_livraison_client_check
  on public.naxa_delivery_commission_ledger is
  'Les nouvelles livraisons sont facturées entre 1 500 et 3 500 FCFA ; les anciennes écritures restent conservées.';

comment on constraint naxa_delivery_commission_ledger_solde_livraison_check
  on public.naxa_delivery_commission_ledger is
  'Solde après commission fixe NAXA de 500 FCFA ; minimum 1 000 FCFA.';

commit;
