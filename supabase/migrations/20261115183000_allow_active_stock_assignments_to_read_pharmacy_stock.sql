-- Give only explicitly assigned, currently active Stock/Magasinier staff
-- read access to their pharmacy stock rows. All writes remain behind the
-- existing audited SECURITY DEFINER stock RPCs and their specific guards.

create policy stocks_read_active_stock_assignment
on public.stocks
for select
to authenticated
using (
  public.naxa_has_active_professional_assignment(
    (select auth.uid()),
    pharmacie_id,
    'gestionnaire_stock'
  )
  or public.naxa_has_active_professional_assignment(
    (select auth.uid()),
    pharmacie_id,
    'magasinier'
  )
);
