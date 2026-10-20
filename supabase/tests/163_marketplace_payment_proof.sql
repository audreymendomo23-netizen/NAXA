-- NAXA 163 — aucun changement de statut ne peut simuler un paiement.
begin;

do $structure$
declare
  v_private text;
  v_public text;
  v_command text;
begin
  select pg_get_functiondef(p.oid) into v_private
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='private' and p.proname='set_reservation_status' and p.pronargs=2;

  select pg_get_functiondef(p.oid) into v_public
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='set_reservation_status' and p.pronargs=2;

  select pg_get_functiondef(p.oid) into v_command
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='mettre_a_jour_commande_client' and p.pronargs=3;

  if v_private is null or position('public.vente_paiements' in lower(v_private))=0
     or position('public.ventes' in lower(v_private))=0
     or position('ticket pos payé' in lower(v_private))=0 then
    raise exception 'La transition privée ne vérifie pas la preuve POS';
  end if;

  if v_public is null or position('private.set_reservation_status' in lower(v_public))=0 then
    raise exception 'La RPC publique ne délègue pas à la transition privée protégée';
  end if;

  if v_command is null or position('paiement non confirmé' in lower(v_command))=0
     or position('v.reservation_id = v_r.id' in lower(v_command))=0
     or position('public.vente_paiements' in lower(v_command))=0 then
    raise exception 'La commande peut encore confirmer un paiement sans ticket POS lié';
  end if;

  if not has_function_privilege('authenticated','public.set_reservation_status(uuid,public.resa_statut)','EXECUTE')
     or not has_function_privilege('authenticated','public.mettre_a_jour_commande_client(uuid,text,boolean)','EXECUTE') then
    raise exception 'Droits RPC authentifiés manquants';
  end if;

  if has_function_privilege('anon','public.set_reservation_status(uuid,public.resa_statut)','EXECUTE')
     or has_function_privilege('anon','public.mettre_a_jour_commande_client(uuid,text,boolean)','EXECUTE') then
    raise exception 'Une RPC de transition est exécutable par anon';
  end if;
end
$structure$;

do $behavior$
declare
  v_admin uuid := gen_random_uuid();
  v_pharmacy uuid := gen_random_uuid();
  v_reservation uuid := gen_random_uuid();
  v_order uuid := gen_random_uuid();
  v_rejected boolean;
  v_status public.resa_statut;
  v_payment_status text;
begin
  set local session_replication_role = replica;
  insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
  values(v_admin,'authenticated','authenticated','naxa163_'||substr(replace(v_admin::text,'-',''),1,12)||'@invalid.local','',now(),now());
  set local session_replication_role = origin;

  insert into public.profiles(id,role,username,actif)
  values(v_admin,'admin','naxa163_'||substr(replace(v_admin::text,'-',''),1,12),true);

  insert into public.pharmacies(id,nom,lat,lng,actif,visible_recherche)
  values(v_pharmacy,'NAXA TEST 163',3.8667,11.5167,true,true);

  insert into public.reservations(
    id,client_id,pharmacie_id,statut,total,expires_at,created_at,mode,
    paiement_statut,paiement_mode,frais_livraison,commande_statut
  ) values
    (v_reservation,v_admin,v_pharmacy,'confirmee',100,now()+interval '1 hour',now(),
     'reservation','a_verifier','especes_retrait',0,'en_attente_pharmacie'),
    (v_order,v_admin,v_pharmacy,'confirmee',100,now()+interval '1 hour',now(),
     'commande','a_verifier','a_convenir',0,'en_attente_pharmacie');

  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  v_rejected := false;
  begin
    perform public.set_reservation_status(v_reservation,'payee'::public.resa_statut);
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'Une réservation sans ticket POS a été marquée payée'; end if;

  select statut,paiement_statut into v_status,v_payment_status
  from public.reservations where id=v_reservation;
  if v_status <> 'confirmee' or v_payment_status <> 'a_verifier' then
    raise exception 'La tentative refusée a modifié la réservation';
  end if;

  v_rejected := false;
  begin
    perform public.mettre_a_jour_commande_client(v_order,'en_attente_pharmacie',true);
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'Une commande sans ticket POS a été marquée payée'; end if;

  select statut,paiement_statut into v_status,v_payment_status
  from public.reservations where id=v_order;
  if v_status <> 'confirmee' or v_payment_status <> 'a_verifier' then
    raise exception 'La tentative de paiement de commande refusée a modifié la réservation';
  end if;
end
$behavior$;

select '163_marketplace_payment_proof PASS' as resultat;
rollback;
