-- NAXA ERP-011 — bidirectional compatibility sync on updates as well as inserts.
create or replace function public.stocks_lots_sync_compat()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
 if tg_op='INSERT' then
  new.numero_lot:=coalesce(nullif(btrim(new.numero_lot),''),nullif(btrim(new.lot),''));
  new.lot:=coalesce(nullif(btrim(new.lot),''),new.numero_lot);
  new.date_peremption:=coalesce(new.date_peremption,new.peremption);
  new.peremption:=coalesce(new.peremption,new.date_peremption);
 else
  if new.numero_lot is distinct from old.numero_lot and new.lot is not distinct from old.lot then
   new.lot:=new.numero_lot;
  elsif new.lot is distinct from old.lot and new.numero_lot is not distinct from old.numero_lot then
   new.numero_lot:=new.lot;
  elsif new.numero_lot is distinct from new.lot then
   raise exception 'Les deux références de lot doivent être identiques';
  end if;
  if new.date_peremption is distinct from old.date_peremption and new.peremption is not distinct from old.peremption then
   new.peremption:=new.date_peremption;
  elsif new.peremption is distinct from old.peremption and new.date_peremption is not distinct from old.date_peremption then
   new.date_peremption:=new.peremption;
  elsif new.date_peremption is distinct from new.peremption then
   raise exception 'Les deux dates de péremption doivent être identiques';
  end if;
 end if;
 if new.numero_lot is null or new.lot is null then raise exception 'Numéro de lot requis'; end if;
 if new.date_peremption is null then raise exception 'Date de péremption requise dans le schéma historique'; end if;
 return new;
end;
$$;
revoke all on function public.stocks_lots_sync_compat() from public,anon,authenticated;
grant execute on function public.stocks_lots_sync_compat() to authenticated;
