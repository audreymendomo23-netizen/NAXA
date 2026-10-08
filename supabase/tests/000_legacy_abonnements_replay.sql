-- N4 regression: la couche historique d'abonnements doit rester replayable.
select to_regclass('public.abonnements') is not null as abonnements_exists;
select to_regclass('public.abonnement_paiements') is not null as abonnement_paiements_exists;
select exists (
  select 1
  from information_schema.columns
  where table_schema='public' and table_name='abonnements'
    and column_name='pharmacie_id'
) as abonnements_pharmacie_fk;
