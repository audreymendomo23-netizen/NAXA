-- NAXA 161 — structure et comportement du paiement comptoir lié à une réservation.
begin;

do $structure$
declare
  v_fn text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='ventes' and column_name='reservation_id'
  ) then raise exception 'ventes.reservation_id absent'; end if;

  if not exists (
    select 1 from pg_indexes where schemaname='public' and indexname='ventes_reservation_id_uq'
  ) then raise exception 'Index unique empêchant le double encaissement absent'; end if;

  select pg_get_functiondef(p.oid) into v_fn
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='vente_reservation_encaisser' and p.pronargs=3;

  if v_fn is null
     or position('auth.uid()' in lower(v_fn))=0
     or position('p_session' in lower(v_fn))=0
     or position('naxa_caisse_actor_for_pharmacy' in lower(v_fn))=0
     or position('p_montant_percu' in lower(v_fn))=0
     or position('public.vente_encaisser_finaliser' in lower(v_fn))=0
     or position('public.set_reservation_status' in lower(v_fn))=0
     or position('reservation_items' in lower(v_fn))=0
     or position('expires_at' in lower(v_fn))=0 then
    raise exception 'Encaissement réservation : garde de session, expiration ou finalisation incomplète';
  end if;

  if position('update public.stocks' in lower(v_fn))>0
     or position('update public.stocks_lots' in lower(v_fn))>0 then
    raise exception 'La réservation débite le stock une seconde fois';
  end if;

  if not has_function_privilege('authenticated','public.vente_reservation_encaisser(uuid,uuid,integer)','EXECUTE')
     or has_function_privilege('anon','public.vente_reservation_encaisser(uuid,uuid,integer)','EXECUTE') then
    raise exception 'Droits EXECUTE de l’encaissement réservation incorrects';
  end if;
end
$structure$;

do $behavior$
declare
  v_admin uuid := gen_random_uuid();
  v_pharmacie uuid := gen_random_uuid();
  v_caisse uuid := gen_random_uuid();
  v_session uuid := gen_random_uuid();
  v_reservation uuid := gen_random_uuid();
  v_produit uuid;
  v_result record;
  v_rejected boolean := false;
  v_count integer;
begin
  select id into v_produit from public.produits limit 1;
  if v_produit is null then raise exception 'Aucun produit de test disponible'; end if;

  set local session_replication_role = replica;
  insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
  values(v_admin,'authenticated','authenticated','naxa161_'||substr(replace(v_admin::text,'-',''),1,12)||'@invalid.local','',now(),now());
  set local session_replication_role = origin;

  insert into public.profiles(id,role,username,actif)
  values(v_admin,'admin','naxa161_'||substr(replace(v_admin::text,'-',''),1,12),true);

  insert into public.pharmacies(id,nom,lat,lng,actif,visible_recherche)
  values(v_pharmacie,'NAXA TEST 161',3.8667,11.5167,true,true);

  insert into public.caisses(id,pharmacie_id,nom,actif)
  values(v_caisse,v_pharmacie,'Caisse test 161',true);

  insert into public.caisses_sessions(id,caisse_id,ouvert_par,fond_initial,statut)
  values(v_session,v_caisse,v_admin,0,'ouverte');

  insert into public.reservations(
    id,client_id,pharmacie_id,statut,total,expires_at,created_at,mode,
    paiement_statut,paiement_mode,frais_livraison
  )
  values(
    v_reservation,v_admin,v_pharmacie,'confirmee',100,now()+interval '1 hour',now(),
    'reservation','a_verifier','especes_retrait',0
  );

  insert into public.reservation_items(reservation_id,produit_id,quantite,prix_unitaire)
  values(v_reservation,v_produit,1,100);

  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  -- Un montant insuffisant doit tout annuler : ni vente brouillon ni paiement orphelin.
  begin
    perform * from public.vente_reservation_encaisser(v_reservation,v_session,99);
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'Un montant espèces insuffisant a été accepté'; end if;
  select count(*) into v_count from public.ventes where reservation_id=v_reservation;
  if v_count <> 0 then raise exception 'Échec de paiement : vente partielle persistée'; end if;

  select * into v_result
  from public.vente_reservation_encaisser(v_reservation,v_session,200);

  if v_result.total <> 100 or v_result.monnaie_rendue <> 100 or v_result.numero_vente is null then
    raise exception 'Montants ou numéro de ticket incorrects';
  end if;

  select count(*) into v_count
  from public.ventes v
  join public.vente_paiements p on p.vente_id=v.id
  where v.reservation_id=v_reservation
    and v.statut='payee'
    and v.total_net=100
    and p.mode='especes'
    and p.montant=100
    and p.montant_percu=200
    and p.monnaie_rendue=100;
  if v_count <> 1 then raise exception 'La vente et son paiement ne sont pas enregistrés atomiquement'; end if;

  if not exists (
    select 1 from public.reservations
    where id=v_reservation and statut='payee' and paiement_statut='effectue' and paiement_mode='especes_retrait'
  ) then raise exception 'La réservation n’a pas été marquée payée'; end if;

  v_rejected := false;
  begin
    perform * from public.vente_reservation_encaisser(v_reservation,v_session,100);
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'Un deuxième encaissement de la même réservation a été accepté'; end if;

  select count(*) into v_count from public.ventes where reservation_id=v_reservation;
  if v_count <> 1 then raise exception 'Le garde anti-double-encaissement est inefficace'; end if;
end
$behavior$;

select '161_caisse_reservation_atomic_payment PASS' as resultat;
rollback;
