-- NAXA 220 — keep legacy lot-allocation guard compatible with non-decrementing reservation holds.
-- New reservations reserve sellable availability only; they must not block a later first lot receipt.
begin;

create or replace function private.naxa_guard_lot_creation_with_unallocated_reservations()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if exists (
    select 1
    from public.reservations r
    join public.reservation_items ri on ri.reservation_id = r.id
    where r.pharmacie_id = new.pharmacie_id
      and ri.produit_id = new.produit_id
      and r.mode = 'reservation'
      and r.statut in ('en_attente', 'confirmee')
      and r.stock_decremented is true
      and coalesce(r.stock_restored, false) is false
      and r.consumed_at is null
      and coalesce((
        select sum(a.quantite)
        from public.reservation_item_lots a
        where a.reservation_id = r.id
          and a.produit_id = ri.produit_id
          and a.restauree_at is null
      ), 0) < ri.quantite
  ) then
    raise exception 'Création du lot refusée : une ancienne réservation déjà débitée physiquement doit être régularisée avant la lotisation.';
  end if;
  return new;
end;
$function$;

revoke all on function private.naxa_guard_lot_creation_with_unallocated_reservations() from public, anon, authenticated;
commit;
