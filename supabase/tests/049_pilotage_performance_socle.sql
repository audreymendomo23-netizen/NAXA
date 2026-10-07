-- NAXA — Partie 2 : test contradictoire du socle Performance
begin;

do $$
declare
  admin_id uuid := gen_random_uuid();
  promoter_id uuid := gen_random_uuid();
  p1 uuid := '00000000-0000-0000-0000-000000000001';
  p2 uuid := '00000000-0000-0000-0000-000000000002';
  prod uuid;
  v jsonb;
begin
  -- Fixtures transactionnelles : aucune persistance après rollback.
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
  values
   (admin_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','part2-admin@naxa.local','x',now(),now(),now()),
   (promoter_id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','part2-promoter@naxa.local','x',now(),now(),now());

  insert into public.profiles(id,role,pharmacie_id,actif,niveau_hierarchique,fonction_interne,niveau_interne,architecture_code)
  values
   (admin_id,'admin',null,true,0,null,null,null),
   (promoter_id,'promoteur',p1,true,1,'promoteur',1,'ORPHELIN');

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

  select id into prod from public.produits order by id limit 1;
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
