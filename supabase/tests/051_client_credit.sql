-- NAXA ERP-010 — test structurel fiche client / crédit
do $$
begin
  if to_regclass('public.client_fiches') is null then raise exception 'ERP-010: client_fiches absent'; end if;
  if to_regclass('public.client_credits') is null then raise exception 'ERP-010: client_credits absent'; end if;
  if to_regclass('public.client_credit_operations') is null then raise exception 'ERP-010: client_credit_operations absent'; end if;
  if to_regclass('public.client_credit_requests') is null then raise exception 'ERP-010: client_credit_requests absent'; end if;
  if not exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typname='mode_paiement_caisse') then raise exception 'ERP-010: enum paiement absent'; end if;
  if not exists(select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='mode_paiement_caisse' and e.enumlabel='credit') then raise exception 'ERP-010: mode credit absent'; end if;
  if (select relrowsecurity from pg_class where oid='public.client_credits'::regclass) is not true then raise exception 'ERP-010: RLS crédit absente'; end if;
  if has_table_privilege('authenticated','public.client_credits','INSERT') then raise exception 'ERP-010: INSERT direct crédit interdit'; end if;
  if has_table_privilege('authenticated','public.client_credit_operations','INSERT') then raise exception 'ERP-010: INSERT direct opérations interdit'; end if;
  if has_table_privilege('authenticated','public.client_credit_requests','INSERT') then raise exception 'ERP-010: INSERT direct demandes interdit'; end if;
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='client_credit_demander') then raise exception 'ERP-010: RPC demande absente'; end if;
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='client_credit_demande_decider') then raise exception 'ERP-010: RPC décision absente'; end if;

  if not exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='client_credit_enregistrer_vente'
      and pg_get_functiondef(p.oid) like '%vente_ajouter_paiement%'
  ) then raise exception 'ERP-010: crédit POS non raccordé à vente_paiements'; end if;
end $;
