-- NAXA 202 — verrou transactionnel des mouvements pendant un inventaire.
begin;
create or replace function private.naxa_bloquer_mouvement_stock_pendant_inventaire()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_pharmacie uuid;
begin
 if tg_op='DELETE' then v_pharmacie:=old.pharmacie_id;
 else v_pharmacie:=new.pharmacie_id;
 end if;
 if exists(select 1 from public.inventaires i where i.pharmacie_id=v_pharmacie and i.statut in ('brouillon','en_cours')) then
  raise exception 'Mouvement de stock bloqué : un inventaire est ouvert pour cette pharmacie. Terminez ou annulez le comptage avant de poursuivre.';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$function$;
revoke all on function private.naxa_bloquer_mouvement_stock_pendant_inventaire() from public,anon,authenticated;

drop trigger if exists trg_stock_insert_blocked_during_inventory on public.stocks;
create trigger trg_stock_insert_blocked_during_inventory before insert on public.stocks
for each row execute function private.naxa_bloquer_mouvement_stock_pendant_inventaire();
drop trigger if exists trg_stock_quantity_blocked_during_inventory on public.stocks;
create trigger trg_stock_quantity_blocked_during_inventory before update of quantite on public.stocks
for each row when (old.quantite is distinct from new.quantite) execute function private.naxa_bloquer_mouvement_stock_pendant_inventaire();
drop trigger if exists trg_stock_delete_blocked_during_inventory on public.stocks;
create trigger trg_stock_delete_blocked_during_inventory before delete on public.stocks
for each row execute function private.naxa_bloquer_mouvement_stock_pendant_inventaire();

drop trigger if exists trg_stock_lot_insert_blocked_during_inventory on public.stocks_lots;
create trigger trg_stock_lot_insert_blocked_during_inventory before insert on public.stocks_lots
for each row execute function private.naxa_bloquer_mouvement_stock_pendant_inventaire();
drop trigger if exists trg_stock_lot_quantity_blocked_during_inventory on public.stocks_lots;
create trigger trg_stock_lot_quantity_blocked_during_inventory before update of quantite on public.stocks_lots
for each row when (old.quantite is distinct from new.quantite) execute function private.naxa_bloquer_mouvement_stock_pendant_inventaire();
drop trigger if exists trg_stock_lot_delete_blocked_during_inventory on public.stocks_lots;
create trigger trg_stock_lot_delete_blocked_during_inventory before delete on public.stocks_lots
for each row execute function private.naxa_bloquer_mouvement_stock_pendant_inventaire();
commit;
