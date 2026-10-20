-- NAXA 159 — tests structurels et comportementaux de l’audit POS et du verrouillage.
-- Toutes les données ci-dessous sont des fixtures de test, dans une transaction annulée.
begin;

do $test$
declare
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_pharmacie_a uuid := gen_random_uuid();
  v_pharmacie_b uuid := gen_random_uuid();
  v_caisse_a uuid := gen_random_uuid();
  v_caisse_b uuid := gen_random_uuid();
  v_session_a uuid := gen_random_uuid();
  v_session_b uuid := gen_random_uuid();
  v_vente_a uuid := gen_random_uuid();
  v_vente_b uuid := gen_random_uuid();
  v_produit uuid;
  v_count_a integer;
  v_count_b integer;
  v_rejected boolean := false;
  v_policy text;
begin
  if to_regclass('public.caisse_audit_events') is null
     or to_regclass('public.caisse_audit_chain_heads') is null then
    raise exception 'Tables de chaîne d’audit absentes';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_caisse_audit_ventes' and not tgisinternal
  ) then raise exception 'Trigger d’audit ventes absent'; end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_naxa_caisse_vente_closed_lock' and not tgisinternal
  ) then raise exception 'Trigger de verrouillage des ventes absent'; end if;

  if has_table_privilege('authenticated','public.caisse_audit_events','INSERT')
     or has_table_privilege('authenticated','public.caisse_audit_events','UPDATE')
     or has_table_privilege('authenticated','public.caisse_audit_events','DELETE')
     or has_table_privilege('authenticated','public.caisse_audit_chain_heads','SELECT')
     or has_table_privilege('anon','public.caisse_audit_events','SELECT') then
    raise exception 'Droits directs trop larges sur le journal ou sa tête';
  end if;

  select qual into v_policy from pg_policies
  where schemaname='public' and tablename='caisse_audit_events'
    and policyname='caisse_audit_events_read_scope' and cmd='SELECT';
  if v_policy is null
     or position('can_access_pharmacy' in v_policy)=0
     or position('is_admin' in v_policy)=0 then
    raise exception 'Politique RLS du journal non bornée au périmètre';
  end if;

  -- Fixtures : deux Promoteurs associés chacun à une seule pharmacie de test.
  set local session_replication_role = replica;
  insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
  values
    (v_user_a,'authenticated','authenticated','naxa159a_'||substr(replace(v_user_a::text,'-',''),1,10)||'@invalid.local','',now(),now()),
    (v_user_b,'authenticated','authenticated','naxa159b_'||substr(replace(v_user_b::text,'-',''),1,10)||'@invalid.local','',now(),now());
  set local session_replication_role = origin;

  insert into public.profiles(id,role,username,actif)
  values
    (v_user_a,'promoteur','naxa159a_'||substr(replace(v_user_a::text,'-',''),1,10),true),
    (v_user_b,'promoteur','naxa159b_'||substr(replace(v_user_b::text,'-',''),1,10),true);

  insert into public.pharmacies(id,nom,lat,lng) values
    (v_pharmacie_a,'NAXA TEST 159 A',3.8667,11.5167),
    (v_pharmacie_b,'NAXA TEST 159 B',3.9000,11.5500);

  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values (v_user_a,v_pharmacie_a,true),(v_user_b,v_pharmacie_b,true);

  insert into public.caisses(id,pharmacie_id,nom,actif) values
    (v_caisse_a,v_pharmacie_a,'Caisse test A',true),
    (v_caisse_b,v_pharmacie_b,'Caisse test B',true);

  insert into public.caisses_sessions(id,caisse_id,ouvert_par,fond_initial,statut)
  values
    (v_session_a,v_caisse_a,v_user_a,0,'ouverte'),
    (v_session_b,v_caisse_b,v_user_b,0,'ouverte');

  -- Créer des données POS dans les deux pharmacies pour éprouver toutes les politiques RLS.
  select id into v_produit from public.produits order by id limit 1;
  if v_produit is null then
    raise exception 'Aucun produit de fixture disponible pour le test RLS';
  end if;

  insert into public.ventes(
    id,pharmacie_id,caisse_session_id,statut,total_brut,total_net,created_by
  ) values
    (v_vente_a,v_pharmacie_a,v_session_a,'brouillon',1,1,v_user_a),
    (v_vente_b,v_pharmacie_b,v_session_b,'brouillon',1,1,v_user_b);

  insert into public.vente_lignes(vente_id,produit_id,quantite,prix_unitaire)
  values (v_vente_a,v_produit,1,1),(v_vente_b,v_produit,1,1);

  insert into public.vente_paiements(vente_id,mode,montant,created_by)
  values
    (v_vente_a,'especes',1,v_user_a),
    (v_vente_b,'especes',1,v_user_b);

  update public.ventes set statut='payee',paid_at=now() where id=v_vente_a;

  -- Fermer la session A, puis vérifier que toute modification ultérieure est refusée.
  update public.caisses_sessions
  set statut='cloturee',cloture_at=now(),cloture_par=v_user_a,
      total_theorique=0,total_compte=0,ecart=0
  where id=v_session_a;

  v_rejected := false;
  begin
    update public.caisses_sessions set total_compte=1 where id=v_session_a;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'Session clôturée modifiable : verrou absent'; end if;

  v_rejected := false;
  begin
    update public.ventes set total_net=2 where id=v_vente_a;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'Vente finalisée d’une session clôturée modifiable'; end if;

  -- Les deux pharmacies ont des événements dans la chaîne.
  if not exists(select 1 from public.caisse_audit_events where pharmacie_id=v_pharmacie_a)
     or not exists(select 1 from public.caisse_audit_events where pharmacie_id=v_pharmacie_b) then
    raise exception 'Les mutations de caisse ne produisent pas de trace chaînée';
  end if;

  -- Vérification cryptographique de la chaîne et de la continuité des séquences.
  if exists (
    select 1
    from (
      select e.*,
        lag(e.event_hash) over(partition by e.pharmacie_id order by e.sequence_no) as prior_hash,
        row_number() over(partition by e.pharmacie_id order by e.sequence_no) as expected_sequence,
        encode(extensions.digest(convert_to(e.hash_payload::text,'UTF8'),'sha256'),'hex') as recomputed_hash
      from public.caisse_audit_events e
      where e.pharmacie_id in (v_pharmacie_a,v_pharmacie_b)
    ) chain
    where chain.event_hash <> chain.recomputed_hash
       or chain.sequence_no <> chain.expected_sequence
       or chain.previous_hash <> coalesce(chain.prior_hash,repeat('0',64))
  ) then raise exception 'Intégrité de la chaîne SHA-256 invalide'; end if;

  perform set_config('naxa.test.user_a',v_user_a::text,true);
  perform set_config('naxa.test.pharmacie_a',v_pharmacie_a::text,true);
  perform set_config('naxa.test.pharmacie_b',v_pharmacie_b::text,true);
end
$test$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('naxa.test.user_a'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $rls$
declare
  v_pharmacie_a uuid := current_setting('naxa.test.pharmacie_a')::uuid;
  v_pharmacie_b uuid := current_setting('naxa.test.pharmacie_b')::uuid;
  v_count_a integer;
  v_count_b integer;
begin
  -- Caisse : l'utilisateur A ne voit que les caisses de sa pharmacie.
  select count(*) into v_count_a from public.caisses where pharmacie_id=v_pharmacie_a;
  select count(*) into v_count_b from public.caisses where pharmacie_id=v_pharmacie_b;
  if v_count_a <> 1 or v_count_b <> 0 then
    raise exception 'RLS caisses : isolation inter-pharmacies invalide (propre %, autre %)',v_count_a,v_count_b;
  end if;

  -- Sessions : le périmètre est dérivé de la caisse liée.
  select count(*) into v_count_a from public.caisses_sessions s join public.caisses c on c.id=s.caisse_id where c.pharmacie_id=v_pharmacie_a;
  select count(*) into v_count_b from public.caisses_sessions s join public.caisses c on c.id=s.caisse_id where c.pharmacie_id=v_pharmacie_b;
  if v_count_a <> 1 or v_count_b <> 0 then
    raise exception 'RLS sessions : isolation inter-pharmacies invalide (propre %, autre %)',v_count_a,v_count_b;
  end if;

  -- Ventes.
  select count(*) into v_count_a from public.ventes where pharmacie_id=v_pharmacie_a;
  select count(*) into v_count_b from public.ventes where pharmacie_id=v_pharmacie_b;
  if v_count_a <> 1 or v_count_b <> 0 then
    raise exception 'RLS ventes : isolation inter-pharmacies invalide (propre %, autre %)',v_count_a,v_count_b;
  end if;

  -- Lignes et paiements héritent du périmètre de la vente.
  select count(*) into v_count_a from public.vente_lignes l join public.ventes v on v.id=l.vente_id where v.pharmacie_id=v_pharmacie_a;
  select count(*) into v_count_b from public.vente_lignes l join public.ventes v on v.id=l.vente_id where v.pharmacie_id=v_pharmacie_b;
  if v_count_a <> 1 or v_count_b <> 0 then
    raise exception 'RLS lignes : isolation inter-pharmacies invalide (propre %, autre %)',v_count_a,v_count_b;
  end if;

  select count(*) into v_count_a from public.vente_paiements p join public.ventes v on v.id=p.vente_id where v.pharmacie_id=v_pharmacie_a;
  select count(*) into v_count_b from public.vente_paiements p join public.ventes v on v.id=p.vente_id where v.pharmacie_id=v_pharmacie_b;
  if v_count_a <> 1 or v_count_b <> 0 then
    raise exception 'RLS paiements : isolation inter-pharmacies invalide (propre %, autre %)',v_count_a,v_count_b;
  end if;

  -- Journal d'audit.
  select count(*) into v_count_a from public.caisse_audit_events where pharmacie_id=v_pharmacie_a;
  select count(*) into v_count_b from public.caisse_audit_events where pharmacie_id=v_pharmacie_b;
  if v_count_a < 1 then raise exception 'RLS : l’utilisateur ne voit pas les traces de sa pharmacie'; end if;
  if v_count_b <> 0 then raise exception 'RLS : fuite de traces d’une autre pharmacie'; end if;
end
$rls$;

reset role;
rollback;

select '159_caisse_audit_chain_lock PASS' as resultat;
