-- NAXA — Partie 2 : test contradictoire du socle Performance
begin;

do $$
declare
  admin_id uuid := gen_random_uuid();
  promoter_id uuid := gen_random_uuid();
  p1 uuid := gen_random_uuid();
  p2 uuid := gen_random_uuid();
  prod uuid;
  v jsonb;
begin
  -- Fixtures transactionnelles : aucune persistance après rollback.
  insert into public.pharmacies(id,nom,ville,lat,lng,actif)
  values
    (p1,'PART2 Pharmacie Active','Yaoundé',3.848,11.502,true),
    (p2,'PART2 Pharmacie Inactive','Yaoundé',3.849,11.503,false);

  insert into auth.users(id,email,raw_user_meta_data)
  values
   (admin_id,'part2-admin@naxa.local',jsonb_build_object('username','part2admin','first_name','Partie','last_name','Admin','phone','+237690000001','phone_country','CM','date_of_birth','1980-01-01','consent_accepted',true)),
   (promoter_id,'part2-promoter@naxa.local',jsonb_build_object('username','part2promoter','first_name','Partie','last_name','Promoteur','phone','+237690000002','phone_country','CM','date_of_birth','1980-01-01','consent_accepted',true));

  update public.profiles
  set role='admin',pharmacie_id=null,actif=true,niveau_hierarchique=0,fonction_interne=null,niveau_interne=null,architecture_code=null
  where id=admin_id;
  update public.profiles
  set role='promoteur',pharmacie_id=p1,actif=true,niveau_hierarchique=1,fonction_interne='promoteur',niveau_interne=1,architecture_code='ORPHELIN'
  where id=promoter_id;

  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(promoter_id,p1,true);
  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(promoter_id,p2,false);

  insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,max_responsables,max_caisses,active)
  values(p1,'ORPHELIN',admin_id,0,1,true)
  on conflict(pharmacie_id) do update set architecture_code='ORPHELIN',assigned_by=admin_id,max_responsables=0,max_caisses=1,active=true;

  insert into public.conventions_promoteurs(promoteur_id,tarif_mensuel,montant_paye,date_paiement,date_expiration,statut)
  values(promoter_id,30000,30000,now(),current_date+30,'actif');
  insert into public.abonnements_promoteurs(convention_id,promoteur_id,debut,echeance,statut,dernier_paiement_le)
  select c.id,promoter_id,current_date,current_date+30,'actif',now()
  from public.conventions_promoteurs c where c.promoteur_id=promoter_id;

  perform set_config('request.jwt.claims',json_build_object('sub',admin_id,'role','authenticated')::text,true);
  perform public.naxa_grant_privilege(promoter_id,'VIEW_NETWORK_PILOTAGE',p1,'RESEAU');

  insert into public.produits(nom,dci,dosage,forme) values('PART2 TEST','TEST','1','unite') returning id into prod;
  insert into public.reservations(client_id,pharmacie_id,statut,total,expires_at)
  values(promoter_id,p1,'payee',12000,now()+interval '1 hour');
  insert into public.reservation_items(reservation_id,produit_id,quantite,prix_unitaire)
  select r.id,prod,1,12000 from public.reservations r where r.client_id=promoter_id order by r.created_at desc limit 1;

  insert into public.stocks(pharmacie_id,produit_id,prix,quantite)
  values(p1,prod,1200,0)
  on conflict(pharmacie_id,produit_id) do update set quantite=0,prix=1200;

  perform set_config('request.jwt.claims',json_build_object('sub',promoter_id,'role','authenticated')::text,true);
  v:=public.stats_pilotage_scope(7);

  if v->>'role' <> 'promoteur' then raise exception 'PART2_FAIL_ROLE'; end if;
  if (v->'pharmacies'->>'total')::int <> 1 then raise exception 'PART2_FAIL_SCOPE_LEAK'; end if;
  if (v->'commercial'->>'ca_xaf')::bigint <> 12000 then raise exception 'PART2_FAIL_CANONICAL_CA'; end if;
  if (v->'commercial'->>'ventes')::bigint <> 1 then raise exception 'PART2_FAIL_DOUBLE_COUNT'; end if;
  if (v->'performance'->>'ruptures_lignes')::bigint <> 1 then raise exception 'PART2_FAIL_STOCK_RUPTURE'; end if;
  if (v->'performance'->>'couverture_stock_pct')::numeric <> 0 then raise exception 'PART2_FAIL_COVERAGE'; end if;

  update public.abonnements_promoteurs set echeance=current_date-1,statut='impaye' where promoteur_id=promoter_id;
  begin
    perform public.stats_pilotage_scope(7);
    raise exception 'PART2_FAIL_EXPIRED_PROMOTER_ACCESS';
  exception when others then
    if sqlerrm='PART2_FAIL_EXPIRED_PROMOTER_ACCESS' then raise; end if;
  end;

  raise notice 'PART2_GREEN';
end $$;

rollback;
