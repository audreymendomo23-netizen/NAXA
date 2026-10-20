-- NAXA ERP-011 / F64-ADM — only NAXA can broadcast; only a scoped Promoteur can acknowledge.
begin;
do $test$
declare
 v_admin uuid:=gen_random_uuid(); v_promoteur uuid:=gen_random_uuid(); v_ph uuid:=gen_random_uuid(); v_avis uuid; v_dest uuid; v_rejected boolean:=false; v_count integer;
begin
 set local session_replication_role=replica;
 insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
 values(v_admin,'authenticated','authenticated','naxa180a_'||substr(replace(v_admin::text,'-',''),1,10)||'@invalid.local','',now(),now()),
       (v_promoteur,'authenticated','authenticated','naxa180p_'||substr(replace(v_promoteur::text,'-',''),1,10)||'@invalid.local','',now(),now());
 set local session_replication_role=origin;
 insert into public.pharmacies(id,nom,lat,lng,actif,visible_recherche) values(v_ph,'NAXA TEST 180',3.8667,11.5167,true,true);
 insert into public.profiles(id,role,username,actif,pharmacie_id)
 values(v_admin,'admin','naxa180a_'||substr(replace(v_admin::text,'-',''),1,10),true,null),
       (v_promoteur,'promoteur','naxa180p_'||substr(replace(v_promoteur::text,'-',''),1,10),true,v_ph);
 insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(v_promoteur,v_ph,true);

 perform set_config('request.jwt.claim.role','authenticated',true);
 perform set_config('request.jwt.claim.sub',v_promoteur::text,true);
 v_rejected:=false;
 begin perform public.admin_avis_rappel_lot_diffuser('Produit test','LOT-180',null,'Motif officiel','Ne pas vendre le lot'); exception when others then v_rejected:=true; end;
 if not v_rejected then raise exception 'Un Promoteur a pu diffuser un avis réseau NAXA'; end if;

 perform set_config('request.jwt.claim.sub',v_admin::text,true);
 v_avis:=public.admin_avis_rappel_lot_diffuser('Produit test','LOT-180','REF-180','Motif officiel','Ne pas vendre le lot');
 select id into v_dest from public.avis_rappels_lots_destinataires where avis_id=v_avis and pharmacie_id=v_ph;
 if v_dest is null then raise exception 'La pharmacie active n’a pas été ajoutée aux destinataires'; end if;
 select count(*) into v_count from public.avis_rappels_lots_destinataires where avis_id=v_avis;
 if v_count<1 then raise exception 'Aucun destinataire de réseau créé'; end if;

 perform set_config('request.jwt.claim.sub',v_promoteur::text,true);
 perform public.promoteur_accuser_avis_rappel_lot(v_dest);
 if not exists(select 1 from public.avis_rappels_lots_destinataires where id=v_dest and accuse_par=v_promoteur and accuse_at is not null) then
  raise exception 'Accusé de réception non historisé';
 end if;
 if has_table_privilege('authenticated','public.avis_rappels_lots_reseau','INSERT') or has_table_privilege('authenticated','public.avis_rappels_lots_destinataires','UPDATE') then
  raise exception 'Écriture directe des avis réseau encore autorisée';
 end if;
end
$test$;
select '180_admin_rappel_lot_notice PASS' as resultat;
rollback;