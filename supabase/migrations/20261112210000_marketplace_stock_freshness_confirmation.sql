-- NAXA — La dernière confirmation du stock doit aussi être prise en compte
-- lorsqu'un inventaire confirme la même quantité (sans mouvement de quantité).
begin;

create or replace function private.marketplace_stock_last_quantity_update(
  p_pharmacie uuid,
  p_produit uuid
)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $function$
  select greatest(
    (
      select max(j.occurred_at)
      from public.stock_manager_movement_journal j
      where j.pharmacie_id = p_pharmacie
        and j.produit_id = p_produit
        and j.source_table in ('stocks', 'stocks_lots')
        and j.event_type in ('creation', 'quantite', 'suppression')
    ),
    (
      select s.updated_at
      from public.stocks s
      where s.pharmacie_id = p_pharmacie
        and s.produit_id = p_produit
    )
  )
$function$;

revoke all on function private.marketplace_stock_last_quantity_update(uuid, uuid) from public, anon, authenticated;
commit;
