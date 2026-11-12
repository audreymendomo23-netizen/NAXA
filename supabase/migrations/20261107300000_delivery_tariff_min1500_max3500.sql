-- NAXA — Grille livraison 1 500–3 500 FCFA et commission fixe de 500 FCFA.
-- Les anciennes écritures du grand livre restent immuables; les nouvelles écritures appliquent la nouvelle borne.
begin;

-- Les devis encore actifs sous l'ancien plancher ne doivent plus pouvoir être utilisés.
alter table public.naxa_delivery_quotes
  drop constraint if exists naxa_delivery_quotes_frais_livraison_check;

update public.naxa_delivery_quotes
set expire_le = now()
where frais_livraison < 1500
  and expire_le > now()
  and consomme_le is null;

alter table public.naxa_delivery_quotes
  add constraint naxa_delivery_quotes_frais_livraison_check
    check (frais_livraison between 1500 and 3500) not valid;

-- Les contraintes NOT VALID préservent les anciennes lignes, mais contrôlent toute nouvelle insertion/modification.
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
  'Nouveaux devis client : tarif routier entre 1 500 et 3 500 FCFA.';
comment on constraint naxa_delivery_commission_ledger_frais_livraison_client_check
  on public.naxa_delivery_commission_ledger is
  'Nouvelles livraisons terminées : tarif client entre 1 500 et 3 500 FCFA; les lignes historiques restent conservées.';
comment on constraint naxa_delivery_commission_ledger_solde_livraison_check
  on public.naxa_delivery_commission_ledger is
  'Après commission NAXA fixe de 500 FCFA, le solde livraison est au minimum de 1 000 FCFA.';

commit;
