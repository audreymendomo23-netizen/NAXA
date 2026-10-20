-- NAXA ERP-002/F64 — prevent aggregate stock writes from desynchronizing lot quantities.
create or replace function public.stocks_guard_lot_quantity_consistency()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare v_lots integer;
begin
  select coalesce(sum(l.quantite),0)::integer into v_lots
  from public.stocks_lots l
  where l.pharmacie_id=new.pharmacie_id and l.produit_id=new.produit_id;
  if v_lots>0 and v_lots is distinct from new.quantite then
    raise exception 'Stock lotisé : la quantité agrégée (%) doit rester égale à la somme des lots (%). Utilisez les opérations POS ou la gestion des lots.',new.quantite,v_lots;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_stocks_guard_lot_quantity_consistency on public.stocks;
create trigger trg_stocks_guard_lot_quantity_consistency
before insert or update of quantite on public.stocks
for each row execute function public.stocks_guard_lot_quantity_consistency();
revoke all on function public.stocks_guard_lot_quantity_consistency() from public,anon,authenticated;
