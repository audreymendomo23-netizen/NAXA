-- NAXA Vérification 039 — Réconciliation finale Promoteur
-- Transactionnel : aucun fixture ne doit persister.
begin;
create temp table v39_ids(promoteur uuid,a uuid,b uuid);

do $$
declare p uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
begin
  set local session_replication_role='replica';
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(p,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','v39-promoteur@example.test','x',now(),'{}','{}',now(),now());
  insert into public.profiles(id,role,username,first_name,last_name,phone,phone_country,date_of_birth,age_verified,consent_accepted_at,actif,fonction_interne,niveau_interne,niveau_hierarchique)
  values(p,'promoteur','v39promoteur','V39','Promoteur','+237690000039','CM','1990-01-01',true,now(),true,'promoteur',1,1);
  set local session_replication_role='origin';
  insert into public.pharmacies(id,nom,lat,lng,actif) values(a,'V39 A',3.86,11.51,true),(b,'V39 B',3.87,11.52,true);
  insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses)
  values(a,'ORPHELIN',p,true,0,1),(b,'ORPHELIN',p,true,0,1);
  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(p,a,true),(p,b,true);
  insert into v39_ids values(p,a,b);
end $$;

grant select on v39_ids to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub',(select promoteur::text from v39_ids),true);
select set_config('request.jwt.claims',json_build_object('sub',(select promoteur::text from v39_ids),'role','authenticated')::text,true);

do $$ begin
  if not public.naxa_promoteur_valide((select promoteur from v39_ids))
  then raise exception '39.1 Promoteur valide attendu'; end if;
end $$;

do $$ begin
  if not public.naxa_has_privilege('VIEW_NETWORK_PILOTAGE',null,'RESEAU')
  then raise exception '39.2 privilège réseau attendu'; end if;
end $$;

update public.abonnements
set statut='impaye',echeance=current_date-1
where pharmacie_id=(select a from v39_ids);

do $$ begin
  if public.naxa_promoteur_valide((select promoteur from v39_ids))
  then raise exception '39.3 expiration réseau non bloquante'; end if;
end $$;

do $$ begin
  if public.naxa_has_privilege('VIEW_NETWORK_PILOTAGE',null,'RESEAU')
  then raise exception '39.4 privilège réseau reste actif après expiration'; end if;
end $$;

do $$
begin
  begin
    perform public.stats_pilotage_scope(7);
    raise exception '39.5 pilotage réseau encore accessible après expiration';
  exception when others then
    if sqlerrm <> 'Privilège Pilotage réseau requis' then raise; end if;
  end;
end $$;

update public.abonnements
set statut='actif',echeance=current_date+30
where pharmacie_id=(select a from v39_ids);

do $$ begin
  if not public.naxa_promoteur_valide((select promoteur from v39_ids))
  then raise exception '39.6 réactivation commerciale attendue'; end if;
end $$;

update public.abonnements
set statut='impaye',echeance=current_date-1
where pharmacie_id=(select b from v39_ids);

do $$ begin
  if public.naxa_promoteur_valide((select promoteur from v39_ids))
  then raise exception '39.7 une seule pharmacie expirée doit bloquer tout le réseau'; end if;
end $$;

rollback;
select 'Vérification 039 — Réconciliation finale Promoteur : PASS transactionnel' as resultat;