-- NAXA ERP-011 / F64 — registration of lot records without changing aggregate stock.
begin;
do $test$
declare
 v_promoteur uuid:=gen_random_uuid(); v_caisse uuid:=gen_random_uuid(); v_ph uuid:=gen_random_uuid(); v_produit uuid;
 v_lot1 uuid; v_lot2 uuid; v_rejected boolean:=false; v_sum integer; v_stock integer;
begin
 if has_table_privilege('authenticated','public.stocks_lots','INSERT') or has_table_privilege('authenticated','public.stocks_lots','UPDATE') or has_table_privilege('authenticated','public.stocks_lots','DELETE') then
  raise exception 'Écriture directe sur stocks_lots encore accordée';
 end if;
 select id into v_produit from public.produits limit 1;
 if v_produit is null then raise exception 'Produit de test indisponible'; end if;
 set local session_replication_role=replica;
 insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
 values(v_promoteur,'authenticated','authenticated','naxa177p_'||substr(replace(v_promoteur::text,'-',''),1,10)||'@invalid.local','',now(),now()),
       (v_caisse,'authenticated','authenticated','naxa177c_'||substr(replace(v_caisse::text,'-',''),1,10)||'@invalid.local','',now(),now());
 set local session_replication_role=origin;
 insert into public.pharmacies(id,nom,lat,lng,actif,visible_recherche) values(v_ph,'NAXA TEST 177',3.8667,11.5167,true,true);
 insert into public.profiles(id,role,username,actif,pharmacie_id)
 values(v_promoteur,'promoteur','naxa177p_'||substr(replace(v_promoteur::text,'-',''),1,10),true,v_ph),
       (v_caisse,'caisse','naxa177c_'||substr(replace(v_caisse::text,'-',''),1,10),true,v_ph);
 insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(v_promoteur,v_ph,true);
 insert into public.stocks(pharmacie_id,produit_id,prix,quantite) values(v_ph,v_produit,100,5);
 perform set_config('request.jwt.claim.role','authenticated',true);
 perform set_config('request.jwt.claim.sub',v_promoteur::text,true);
 v_lot1:=public.stock_lot_enregistrer(v_ph,v_produit,'INITIAL-177',current_date+100,5,null);
 v_lot2:=public.stock_lot_enregistrer(v_ph,v_produit,'LOT-177-B',current_date+50,2,v_lot1);
 select sum(quantite)::integer into v_sum from public.stocks_lots where pharmacie_id=v_ph and produit_id=v_produit;
 select quantite into v_stock from public.stocks where pharmacie_id=v_ph and produit_id=v_produit;
 if v_sum<>5 or v_stock<>5 then raise exception 'Création/répartition a changé la quantité agrégée : lots %, stock %',v_sum,v_stock; end if;
 v_rejected:=false;
 begin update public.stocks set quantite=6 where pharmacie_id=v_ph and produit_id=v_produit; exception when others then v_rejected:=true; end;
 if not v_rejected then raise exception 'Une modification directe a désynchronisé stock agrégé et lots'; end if;
 if not exists(select 1 from public.stocks_lots where id=v_lot1 and quantite=3 and lot='INITIAL-177' and numero_lot='INITIAL-177')
    or not exists(select 1 from public.stocks_lots where id=v_lot2 and quantite=2 and lot='LOT-177-B' and numero_lot='LOT-177-B') then
  raise exception 'Répartition ou synchronisation des champs de lot incorrecte';
 end if;
 perform set_config('request.jwt.claim.sub',v_caisse::text,true);
 v_rejected:=false;
 begin perform public.stock_lot_enregistrer(v_ph,v_produit,'LOT-177-C',current_date+40,1,v_lot1); exception when others then v_rejected:=true; end;
 if not v_rejected then raise exception 'La Caisse a pu créer/répartir un lot'; end if;
end
$test$;
select '177_stock_lot_enregistrer PASS' as resultat;
rollback;