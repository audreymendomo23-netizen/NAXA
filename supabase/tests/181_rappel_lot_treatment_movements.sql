-- NAXA ERP-011 / F64-PRO — return/destruction updates the canonical lot and aggregate stock atomically.
begin;
do $test$
declare v_promoteur uuid:=gen_random_uuid(); v_caisse uuid:=gen_random_uuid(); v_ph uuid:=gen_random_uuid(); v_produit uuid; v_lot uuid:=gen_random_uuid(); v_rappel uuid; v_mvt uuid; v_rejected boolean:=false; v_stock integer; v_lot_stock integer; v_count integer;
begin
 select id into v_produit from public.produits limit 1;
 if v_produit is null then raise exception 'Produit de test indisponible'; end if;
 set local session_replication_role=replica;
 insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
 values(v_promoteur,'authenticated','authenticated','naxa181p_'||substr(replace(v_promoteur::text,'-',''),1,10)||'@invalid.local','',now(),now()),
       (v_caisse,'authenticated','authenticated','naxa181c_'||substr(replace(v_caisse::text,'-',''),1,10)||'@invalid.local','',now(),now());
 set local session_replication_role=origin;
 insert into public.pharmacies(id,nom,lat,lng,actif,visible_recherche) values(v_ph,'NAXA TEST 181',3.8667,11.5167,true,true);
 insert into public.profiles(id,role,username,actif,pharmacie_id)
 values(v_promoteur,'promoteur','naxa181p_'||substr(replace(v_promoteur::text,'-',''),1,10),true,v_ph),
       (v_caisse,'caisse','naxa181c_'||substr(replace(v_caisse::text,'-',''),1,10),true,v_ph);
 insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(v_promoteur,v_ph,true),(v_caisse,v_ph,true);
 insert into public.stocks(pharmacie_id,produit_id,prix,quantite) values(v_ph,v_produit,100,5);
 insert into public.stocks_lots(id,pharmacie_id,produit_id,lot,peremption,numero_lot,date_peremption,quantite,bloque,motif_blocage)
 values(v_lot,v_ph,v_produit,'LOT-181',current_date+30,'LOT-181',current_date+30,5,false,null);
 perform set_config('request.jwt.claim.role','authenticated',true);
 perform set_config('request.jwt.claim.sub',v_promoteur::text,true);
 v_rappel:=public.lot_rappeler(v_lot,'Rappel fabricant','REF-181');
 v_mvt:=public.lot_rappel_traiter_sortie(v_rappel,'retour_fournisseur',2,'AVOIR-181','Retour fournisseur confirmé');
 if not exists(select 1 from public.rappels_lots_traitements where id=v_mvt and type='retour_fournisseur' and quantite=2 and reference='AVOIR-181') then raise exception 'Retour fournisseur non historisé'; end if;
 select quantite into v_stock from public.stocks where pharmacie_id=v_ph and produit_id=v_produit;
 select quantite into v_lot_stock from public.stocks_lots where id=v_lot;
 if v_stock<>3 or v_lot_stock<>3 then raise exception 'Retour non atomique : stock %, lot %',v_stock,v_lot_stock; end if;
 perform public.lot_rappel_traiter_sortie(v_rappel,'destruction',1,null,'Destruction sécurisée constatée');
 select quantite into v_stock from public.stocks where pharmacie_id=v_ph and produit_id=v_produit;
 select quantite into v_lot_stock from public.stocks_lots where id=v_lot;
 if v_stock<>2 or v_lot_stock<>2 then raise exception 'Destruction non atomique : stock %, lot %',v_stock,v_lot_stock; end if;
 select count(*) into v_count from public.rappels_lots_traitements where rappel_id=v_rappel;
 if v_count<>2 then raise exception 'Journal des traitements incomplet'; end if;
 v_rejected:=false;
 begin perform public.lot_rappel_traiter_sortie(v_rappel,'destruction',3,null,'Quantité trop élevée'); exception when others then v_rejected:=true; end;
 if not v_rejected then raise exception 'Sortie supérieure au lot restant acceptée'; end if;
 perform set_config('request.jwt.claim.sub',v_caisse::text,true);
 v_rejected:=false;
 begin perform public.lot_rappel_traiter_sortie(v_rappel,'retour_fournisseur',1,null,'Tentative Caisse'); exception when others then v_rejected:=true; end;
 if not v_rejected then raise exception 'La Caisse a pu valider le retour/destruction'; end if;
end
$test$;
select '181_rappel_lot_treatment_movements PASS' as resultat;
rollback;