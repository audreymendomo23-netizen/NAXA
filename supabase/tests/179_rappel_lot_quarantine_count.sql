-- NAXA ERP-011 / F64 — quarantine counts are auditable and do not alter stock.
begin;
do $test$
declare
 v_promoteur uuid:=gen_random_uuid(); v_caisse uuid:=gen_random_uuid(); v_ph uuid:=gen_random_uuid(); v_produit uuid;
 v_lot uuid:=gen_random_uuid(); v_rappel uuid; v_rejected boolean:=false; v_stock integer; v_lot_stock integer;
begin
 select id into v_produit from public.produits limit 1;
 if v_produit is null then raise exception 'Produit de test indisponible'; end if;
 set local session_replication_role=replica;
 insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
 values(v_promoteur,'authenticated','authenticated','naxa179p_'||substr(replace(v_promoteur::text,'-',''),1,10)||'@invalid.local','',now(),now()),
       (v_caisse,'authenticated','authenticated','naxa179c_'||substr(replace(v_caisse::text,'-',''),1,10)||'@invalid.local','',now(),now());
 set local session_replication_role=origin;
 insert into public.pharmacies(id,nom,lat,lng,actif,visible_recherche) values(v_ph,'NAXA TEST 179',3.8667,11.5167,true,true);
 insert into public.profiles(id,role,username,actif,pharmacie_id)
 values(v_promoteur,'promoteur','naxa179p_'||substr(replace(v_promoteur::text,'-',''),1,10),true,v_ph),
       (v_caisse,'caisse','naxa179c_'||substr(replace(v_caisse::text,'-',''),1,10),true,v_ph);
 insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(v_promoteur,v_ph,true),(v_caisse,v_ph,true);
 insert into public.stocks(pharmacie_id,produit_id,prix,quantite) values(v_ph,v_produit,100,5);
 insert into public.stocks_lots(id,pharmacie_id,produit_id,lot,peremption,numero_lot,date_peremption,quantite,bloque,motif_blocage)
 values(v_lot,v_ph,v_produit,'LOT-179',current_date+30,'LOT-179',current_date+30,5,false,null);
 perform set_config('request.jwt.claim.role','authenticated',true);
 perform set_config('request.jwt.claim.sub',v_promoteur::text,true);
 v_rappel:=public.lot_rappeler(v_lot,'Rappel fabricant','REF-179');
 perform set_config('request.jwt.claim.sub',v_caisse::text,true);
 perform public.lot_quarantaine_compter(v_rappel,5,4);
 if not exists(select 1 from public.rappels_lots where id=v_rappel and quantite_trouvee=5 and quantite_isolee=4 and compte_par=v_caisse and compte_at is not null) then
  raise exception 'Comptage de quarantaine non historisé';
 end if;
 select quantite into v_stock from public.stocks where pharmacie_id=v_ph and produit_id=v_produit;
 select quantite into v_lot_stock from public.stocks_lots where id=v_lot;
 if v_stock<>5 or v_lot_stock<>5 then raise exception 'Le comptage a modifié le stock : stock %, lot %',v_stock,v_lot_stock; end if;
 v_rejected:=false;
 begin perform public.lot_quarantaine_compter(v_rappel,3,4); exception when others then v_rejected:=true; end;
 if not v_rejected then raise exception 'Le système a accepté plus d’unités isolées que retrouvées'; end if;
end
$test$;
select '179_rappel_lot_quarantine_count PASS' as resultat;
rollback;