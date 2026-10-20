-- NAXA ERP-011 — keep historical and canonical lot columns synchronized.
create or replace function public.stocks_lots_sync_compat()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if new.numero_lot is null or btrim(new.numero_lot)='' then
    new.numero_lot:=nullif(btrim(new.lot),'');
  end if;
  if new.lot is null or btrim(new.lot)='' then
    new.lot:=new.numero_lot;
  end if;
  if new.date_peremption is null then new.date_peremption:=new.peremption; end if;
  if new.peremption is null then new.peremption:=new.date_peremption; end if;
  if new.numero_lot is null or new.lot is null then
    raise exception 'Numéro de lot requis';
  end if;
  if new.date_peremption is null then
    raise exception 'Date de péremption requise dans le schéma historique';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_stocks_lots_sync_compat on public.stocks_lots;
create trigger trg_stocks_lots_sync_compat
before insert or update of lot,numero_lot,peremption,date_peremption on public.stocks_lots
for each row execute function public.stocks_lots_sync_compat();
revoke all on function public.stocks_lots_sync_compat() from public,anon,authenticated;
grant execute on function public.stocks_lots_sync_compat() to authenticated;
