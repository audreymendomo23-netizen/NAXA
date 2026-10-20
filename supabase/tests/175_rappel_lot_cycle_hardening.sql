-- NAXA ERP-011 / F64 — comportement du cycle de rappel et des permissions.
begin;
do $test$
declare
 v_promoteur uuid:=gen_random_uuid();
 v_caisse uuid:=gen_random_uuid();
 v_ph uuid:=gen_random_uuid();
 v_produit uuid;
 v_lot uuid:=gen_random_uuid();
 v_rappel uuid;
 v_rappel2 uuid;
 v_rejected boolean:=false;
begin
 select id into v_produit from public.produits limit 1;
 if v_produit is null then raise exception 'Produit de test indisponible'; end if;

 set local session_replication_role=replica;
 insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
 values(v_promoteur,'authenticated','authenticated','naxa175p_'||substr(replace(v_promoteur::text,'-',''),1,10)||'@invalid.local','',now(),now()),
       (v_caisse,'authenticated','authenticated','naxa175c_'||substr(replace(v_caisse::text,'-',''),1,10)||'@invalid.local','',now(),now());
 set local session_replication_role=origin;

 insert into public.pharmacies(id,nom,lat,lng,actif,visible_recherche)
 values(v_ph,'NAXA TEST 175',3.8667,11.5167,true,true);
 insert into public.profiles(id,role,username,actif,pharmacie_id)
 values(v_promoteur,'promoteur','naxa175p_'||substr(replace(v_promoteur::text,'-',''),1,10),true,v_ph),
       (v_caisse,'caisse','naxa175c_'||substr(replace(v_caisse::text,'-',''),1,10),true,v_ph);
 insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(v_promoteur,v_ph,true),(v_caisse,v_ph,true);
 insert into public.stocks(pharmacie_id,produit_id,prix,quantite) values(v_ph,v_produit,100,5);
 insert into public.stocks_lots(id,pharmacie_id,produit_id,numero_lot,date_peremption,quantite,bloque,motif_blocage)
 values(v_lot,v_ph,v_produit,'NAXA175-LOT',current_date+30,5,true,'Blocage qualité antérieur');

 perform set_config('request.jwt.claim.role','authenticated',true);
 perform set_config('request.jwt.claim.sub',v_promoteur::text,true);
 v_rappel:=public.lot_rappeler(v_lot,'Retrait fabricant','FAB-175');
 if not exists(select 1 from public.rappels_lots where id=v_rappel and statut='actif' and lot_bloque_avant=true and lot_motif_blocage_avant='Blocage qualité antérieur') then
   raise exception 'Le rappel actif ou la sauvegarde du blocage antérieur est absente';
 end if;
 if not exists(select 1 from public.stocks_lots where id=v_lot and bloque=true and motif_blocage='Retrait fabricant') then
   raise exception 'Le rappel ne bloque pas le lot canonique';
 end if;

 perform set_config('request.jwt.claim.sub',v_caisse::text,true);
 v_rejected:=false;
 begin perform public.lot_lever_rappel(v_lot); exception when others then v_rejected:=true; end;
 if not v_rejected then raise exception 'La Caisse a pu clôturer un rappel de lot'; end if;
 v_rejected:=false;
 begin perform public.lot_rappeler(v_lot,'Tentative Caisse','CASHIER'); exception when others then v_rejected:=true; end;
 if not v_rejected then raise exception 'La Caisse a pu déclarer un rappel de lot'; end if;

 perform set_config('request.jwt.claim.sub',v_promoteur::text,true);
 v_rejected:=false;
 begin perform public.lot_lever_rappel(v_lot); exception when others then v_rejected:=true; end;
 if not v_rejected then raise exception 'Le Promoteur a pu clôturer un rappel avec du stock non traité'; end if;
 perform public.lot_rappel_traiter_sortie(v_rappel,'destruction',5,null,'Destruction du lot de test');
 perform public.lot_lever_rappel(v_lot);
 if not exists(select 1 from public.rappels_lots where id=v_rappel and statut='leve' and leve_par=v_promoteur) then
   raise exception 'La clôture du rappel n''a pas été historisée';
 end if;
 if not exists(select 1 from public.stocks_lots where id=v_lot and bloque=true and motif_blocage='Blocage qualité antérieur') then
   raise exception 'La levée a effacé le blocage antérieur du lot';
 end if;

 v_rappel2:=public.lot_rappeler(v_lot,'Deuxième avis fabricant','FAB-175-2');
 if v_rappel2=v_rappel or not exists(select 1 from public.rappels_lots where id=v_rappel2 and statut='actif') then
   raise exception 'Un nouveau rappel ne peut pas être créé après la clôture du précédent';
 end if;
 perform public.lot_lever_rappel(v_lot);
end
$test$;
select '175_rappel_lot_cycle_hardening PASS' as resultat;
rollback;