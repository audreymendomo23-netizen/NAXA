-- NAXA — Ne jamais rafraîchir un stock ancien à la suite d'une simple modification de métadonnées.
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
  select case
    -- Dès qu'un historique existe, seules les dates des événements physiques
    -- sont recevables. updated_at peut être rafraîchi par stocks_touch lors
    -- d'une modification de prix ou d'autres métadonnées.
    when exists (
      select 1
      from public.stock_manager_movement_journal j
      where j.pharmacie_id = p_pharmacie
        and j.produit_id = p_produit
        and j.source_table in ('stocks', 'stocks_lots')
    ) then (
      select max(j.occurred_at)
      from public.stock_manager_movement_journal j
      where j.pharmacie_id = p_pharmacie
        and j.produit_id = p_produit
        and j.source_table in ('stocks', 'stocks_lots')
        and j.event_type in ('creation', 'quantite', 'suppression')
    )
    -- Compatibilité uniquement pour les anciennes références non journalisées.
    else (
      select s.updated_at
      from public.stocks s
      where s.pharmacie_id = p_pharmacie
        and s.produit_id = p_produit
    )
  end
$function$;

revoke all on function private.marketplace_stock_last_quantity_update(uuid, uuid) from public, anon, authenticated;
commit;
