-- NAXA 258 — comportement de la disponibilité Marketplace avec holds logiques.
-- À exécuter uniquement sur une base de test; toutes les fixtures sont annulées.
begin;
do $test$
declare
  v_client uuid := gen_random_uuid();
  v_pharmacie uuid := gen_random_uuid();
  v_produit uuid := gen_random_uuid();
  v_reservation uuid;
  v_quantite integer;
  v_physique integer;
begin
  set local session_replication_role='replica';
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values(v_client,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
    'naxa258-'||replace(v_client::text,'-','')||'@example.invalid','x',now(),
    '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now());
  set local session_replication_role='origin';

  insert into public.profiles(id,role,first_name,last_name,actif,age_verified,consent_accepted_at,niveau_interne)
  values(v_client,'client','NAXA','258 test',true,true,now(),4);

  insert into public.pharmacies(id,nom,ville,lat,lng,actif,visible_recherche)
  values(v_pharmacie,'NAXA test disponibilité 258','Yaoundé',3.87,11.52,true,true);
  insert into public.produits(id,nom)
  values(v_produit,'NAXA produit test 258');
  insert into public.stocks(pharmacie_id,produit_id,prix,quantite,date_peremption)
  values(v_pharmacie,v_produit,1000,10,current_date+90);

  -- Un hold moderne de 4 unités réduit l'offre vendable à 6, sans débit physique.
  insert into public.reservations(client_id,pharmacie_id,expires_at,mode,statut,total,stock_decremented,stock_restored,consumed_at)
  values(v_client,v_pharmacie,now()+interval '2 hours','reservation','confirmee',4000,false,false,null)
  returning id into v_reservation;
  insert into public.reservation_items(reservation_id,produit_id,quantite,prix_unitaire)
  values(v_reservation,v_produit,4,1000);

  select o.quantite into v_quantite
  from public.marketplace_offre_stock_disponible(v_pharmacie,v_produit) o;
  if v_quantite<>6 then
    raise exception 'Hold actif : disponibilité attendue 6, obtenue %',v_quantite;
  end if;
  select s.quantite into v_physique from public.stocks s
  where s.pharmacie_id=v_pharmacie and s.produit_id=v_produit;
  if v_physique<>10 then raise exception 'Le hold a modifié le stock physique'; end if;

  -- Un hold consommé n'est plus retranché une seconde fois.
  update public.reservations set consumed_at=now() where id=v_reservation;
  select o.quantite into v_quantite
  from public.marketplace_offre_stock_disponible(v_pharmacie,v_produit) o;
  if v_quantite<>10 then
    raise exception 'Hold consommé : disponibilité attendue 10, obtenue %',v_quantite;
  end if;

  -- Une réservation legacy déjà débitée ne doit pas être retranchée deux fois.
  insert into public.reservations(client_id,pharmacie_id,expires_at,mode,statut,total,stock_decremented,stock_restored,consumed_at)
  values(v_client,v_pharmacie,now()+interval '2 hours','reservation','confirmee',2000,true,false,null)
  returning id into v_reservation;
  insert into public.reservation_items(reservation_id,produit_id,quantite,prix_unitaire)
  values(v_reservation,v_produit,2,1000);
  select o.quantite into v_quantite
  from public.marketplace_offre_stock_disponible(v_pharmacie,v_produit) o;
  if v_quantite<>10 then
    raise exception 'Hold legacy déjà débité : disponibilité attendue 10, obtenue %',v_quantite;
  end if;
end;
$test$;
rollback;
select '258_marketplace_availability_subtract_holds PASS' as resultat;
