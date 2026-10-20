-- NAXA ERP-011 — historical lot fields remain synchronized on edits.
begin;
do $test$
declare v_ph uuid; v_prod uuid; v_lot uuid:=gen_random_uuid(); v_date date:=current_date+90;
begin
 select pharmacie_id,produit_id into v_ph,v_prod from public.stocks limit 1;
 if v_ph is null or v_prod is null then raise exception 'Stock fixture indisponible'; end if;
 insert into public.stocks_lots(id,pharmacie_id,produit_id,lot,peremption,numero_lot,date_peremption,quantite,bloque,motif_blocage)
 values(v_lot,v_ph,v_prod,'LOT184-A',v_date,'LOT184-A',v_date,0,false,null);
 update public.stocks_lots set lot='LOT184-B' where id=v_lot;
 if not exists(select 1 from public.stocks_lots where id=v_lot and lot='LOT184-B' and numero_lot='LOT184-B') then raise exception 'Le numéro de lot canonique ne suit pas la colonne historique'; end if;
 update public.stocks_lots set peremption=current_date+80 where id=v_lot;
 if not exists(select 1 from public.stocks_lots where id=v_lot and peremption=current_date+80 and date_peremption=current_date+80) then raise exception 'La date canonique ne suit pas la colonne historique'; end if;
end
$test$;
select '184_stocks_lots_sync_bidirectional PASS' as resultat;
rollback;