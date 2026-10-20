-- NAXA ERP-002/F64 — detect drift even when every recorded lot has zero units.
create or replace function public.stocks_guard_lot_quantity_consistency()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_lots integer; v_has_lots boolean;
begin
 select exists(select 1 from public.stocks_lots l where l.pharmacie_id=new.pharmacie_id and l.produit_id=new.produit_id),
        coalesce((select sum(l.quantite)::integer from public.stocks_lots l where l.pharmacie_id=new.pharmacie_id and l.produit_id=new.produit_id),0)
 into v_has_lots,v_lots;
 if v_has_lots and v_lots is distinct from new.quantite then
  raise exception 'Stock lotisé : la quantité agrégée (%) doit rester égale à la somme des lots (%). Utilisez les opérations POS ou la gestion des lots.',new.quantite,v_lots;
 end if;
 return new;
end; $$;
revoke all on function public.stocks_guard_lot_quantity_consistency() from public,anon,authenticated;
