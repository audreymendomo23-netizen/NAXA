begin;
do $test$
declare
 v_user uuid:=gen_random_uuid(); v_ph uuid:=gen_random_uuid(); v_caisse uuid:=gen_random_uuid(); v_session uuid:=gen_random_uuid();
 v_rejected boolean:=false; v_result record;
begin
 set local session_replication_role=replica;
 insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
 values(v_user,'authenticated','authenticated','naxa168_'||substr(replace(v_user::text,'-',''),1,12)||'@invalid.local','',now(),now());
 set local session_replication_role=origin;
 insert into public.pharmacies(id,nom,lat,lng,actif,visible_recherche) values(v_ph,'NAXA TEST 168',3.8667,11.5167,true,true);
 insert into public.profiles(id,role,username,actif,pharmacie_id) values(v_user,'caisse','naxa168_'||substr(replace(v_user::text,'-',''),1,12),true,v_ph);
 insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(v_user,v_ph,true);
 insert into public.caisses(id,pharmacie_id,nom,actif) values(v_caisse,v_ph,'Caisse test 168',true);
 insert into public.caisses_sessions(id,caisse_id,ouvert_par,fond_initial,statut) values(v_session,v_caisse,v_user,1000,'ouverte');
 perform set_config('request.jwt.claim.sub',v_user::text,true);
 perform set_config('request.jwt.claim.role','authenticated',true);
 begin
  perform * from public.caisse_cloturer(v_session,800,null::text);
 exception when others then
  if position('justification' in lower(sqlerrm))>0 then v_rejected:=true; else raise; end if;
 end;
 if not v_rejected then raise exception 'Un écart a été clôturé sans justification'; end if;
 if not exists(select 1 from public.caisses_sessions where id=v_session and statut='ouverte') then raise exception 'La session a été clôturée malgré la justification manquante'; end if;
 select * into v_result from public.caisse_cloturer(v_session,800,'Écart constaté au comptage');
 if v_result.total_theorique<>1000 or v_result.total_compte<>800 or v_result.ecart<>-200 then raise exception 'Calcul d’écart incorrect'; end if;
 if not exists(select 1 from public.caisses_sessions where id=v_session and statut='cloturee' and ecart=-200 and ecart_statut='a_verifier' and ecart_justification='Écart constaté au comptage') then raise exception 'L’écart ou sa justification n’a pas été conservé'; end if;
end
$test$;
select '168_caisse_ecart_justification PASS' as resultat;
rollback;
