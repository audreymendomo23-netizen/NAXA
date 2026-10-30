-- NAXA 263 — least-privilege RLS for stock service attendance.
begin;
alter table public.stock_service_sessions enable row level security;
alter table public.stock_service_inventory_counts enable row level security;

revoke all on public.stock_service_sessions, public.stock_service_inventory_counts from anon, public;
revoke insert, update, delete on public.stock_service_sessions, public.stock_service_inventory_counts from authenticated;
grant select on public.stock_service_sessions, public.stock_service_inventory_counts to authenticated;

drop policy if exists stock_service_sessions_read_scope on public.stock_service_sessions;
create policy stock_service_sessions_read_scope
  on public.stock_service_sessions for select to authenticated
  using (
    gestionnaire_id = (select auth.uid())
    or (select public.is_admin())
    or (select private.naxa_scope_allows((select auth.uid()), pharmacie_id, 'PHARMACIE'))
  );

drop policy if exists stock_service_counts_read_scope on public.stock_service_inventory_counts;
create policy stock_service_counts_read_scope
  on public.stock_service_inventory_counts for select to authenticated
  using (
    exists (
      select 1 from public.stock_service_sessions s
      where s.id = session_id
        and (
          s.gestionnaire_id = (select auth.uid())
          or (select public.is_admin())
          or (select private.naxa_scope_allows((select auth.uid()), s.pharmacie_id, 'PHARMACIE'))
        )
    )
  );

comment on table public.stock_service_sessions is
  'Pointage de prise/fin de service Stock; lecture RLS personnelle ou selon le scope pharmacie autorisé; écritures par RPC gardées.';
commit;
