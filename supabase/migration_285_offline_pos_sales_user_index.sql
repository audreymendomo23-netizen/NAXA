-- NAXA F07 — index the remaining owner FK on server-owned offline POS sales.
begin;
create index if not exists naxa_offline_sales_user_idx
  on public.naxa_offline_sales (utilisateur_id);
commit;
