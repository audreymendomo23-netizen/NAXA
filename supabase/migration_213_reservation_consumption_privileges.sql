-- NAXA 213 — a reservation may only be consumed inside a trusted cashier transaction.
begin;
revoke all on function public.consume_reservation_for_sale(uuid,uuid) from public, anon, authenticated;
comment on function public.consume_reservation_for_sale(uuid,uuid) is
  'Internal cashier helper. Not callable directly by clients; call only from a trusted sale-finalization transaction after physical stock has been decremented.';
commit;
