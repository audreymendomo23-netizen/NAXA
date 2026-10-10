-- NAXA 026 — validation Partie 1 Promoteur : périmètre réseau
-- Transactionnel : aucune donnée de test ne persiste.

begin;
do $$
declare
  v_promoteur uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_a uuid := '00000000-0000-0000-0000-000000000001';
  v_b uuid := '00000000-0000-0000-0000-000000000002';
  v_c uuid := '00000000-0000-0000-0000-000000000003';
begin
  set local session_replication_role='replica';
  insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,email_confirmed_at,created_at,updated_at,is_sso_user,is_anonymous)
  values(v_promoteur,'authenticated','authenticated','naxa.promoteur.p1@example.invalid','{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now(),now(),false,false)
  on conflict(id) do nothing;
  insert into public.pharmacies(id,nom,ville,lat,lng,slug,est_demo)
  values
    (v_a,'NAXA Test 026 A','Yaoundé',3.8520,11.5060,'naxa-test-026-a',false),
    (v_b,'NAXA Test 026 B','Yaoundé',3.8530,11.5070,'naxa-test-026-b',false),
    (v_c,'NAXA Test 026 C','Yaoundé',3.8540,11.5080,'naxa-test-026-c',false)
  on conflict(id) do nothing;

  set local session_replication_role='origin';

  insert into public.profiles(id,role,actif,fonction_interne,niveau_interne,niveau_hierarchique,architecture_code)
  values(v_promoteur,'promoteur',true,'promoteur',1,1,'PARENTS_AINES_CADETS')
  on conflict(id) do update set role='promoteur',actif=true,fonction_interne='promoteur',niveau_interne=1,niveau_hierarchique=1,architecture_code='PARENTS_AINES_CADETS';

  insert into public.abonnements(pharmacie_id,formule,montant_mensuel,debut,echeance,statut)
  values(v_a,'essentiel',30000,current_date,current_date+30,'actif'),
        (v_b,'essentiel',30000,current_date,current_date+30,'actif')
  on conflict (pharmacie_id) do update
    set echeance=excluded.echeance,statut='actif',montant_mensuel=excluded.montant_mensuel;

  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif)
  values(v_promoteur,v_a,true),(v_promoteur,v_b,true)
  on conflict(promoteur_id,pharmacie_id) do update set actif=true;

  insert into public.pharmacie_architectures(pharmacie_id,architecture_code,assigned_by,active,max_responsables,max_caisses)
  values(v_a,'PARENTS_AINES_CADETS',v_promoteur,true,5,5),(v_b,'PARENTS_AINES_CADETS',v_promoteur,true,5,5)
  on conflict(pharmacie_id) do update set architecture_code=excluded.architecture_code,active=true;

  insert into public.conventions_promoteurs(promoteur_id,montant_mensuel,date_expiration,statut,architecture_code)
  values(v_promoteur,30000,current_date+30,'active','PARENTS_AINES_CADETS')
  on conflict(promoteur_id) do update set architecture_code='PARENTS_AINES_CADETS',statut='active';

  if not public.naxa_scope_allows(v_promoteur,v_a,'PHARMACIE') then raise exception 'scope pharmacie A refusé'; end if;
  if not public.naxa_scope_allows(v_promoteur,v_b,'PHARMACIE') then raise exception 'scope pharmacie B refusé'; end if;
  if public.naxa_scope_allows(v_promoteur,v_c,'PHARMACIE') then raise exception 'scope hors réseau accordé'; end if;

  update public.promoteur_pharmacies set actif=false where promoteur_id=v_promoteur and pharmacie_id=v_b;
  if public.naxa_scope_allows(v_promoteur,v_b,'PHARMACIE') then raise exception 'scope maintenu après désactivation'; end if;
  update public.promoteur_pharmacies set actif=true where promoteur_id=v_promoteur and pharmacie_id=v_b;
  if not public.naxa_scope_allows(v_promoteur,v_b,'PHARMACIE') then raise exception 'scope non restauré après réactivation'; end if;

  if public.naxa_has_privilege('VIEW_PHARMACY',v_c,'PHARMACIE') then raise exception 'privilège hors réseau'; end if;
  if public.naxa_has_privilege('MANAGE_CONVENTION',v_a,'PHARMACIE') then raise exception 'gouvernance convention exposée'; end if;
  if public.naxa_has_privilege('CHANGE_ARCHITECTURE',v_a,'PHARMACIE') then raise exception 'gouvernance architecture exposée'; end if;
  if public.naxa_has_privilege('VIEW_GLOBAL_NETWORK',v_a,'PHARMACIE') then raise exception 'gouvernance réseau global exposée'; end if;

  if has_table_privilege('anon','public.promoteur_pharmacies','SELECT') then raise exception 'anon peut lire le réseau'; end if;
  if not has_table_privilege('authenticated','public.promoteur_pharmacies','SELECT') then raise exception 'authenticated ne peut pas lire le scope'; end if;
  if has_function_privilege('authenticated','public.naxa_provision_promoteur_pharmacie(uuid,uuid)','EXECUTE') then raise exception 'provisioning Promoteur exposé au client'; end if;
end $$;

select 'GREEN' as status, 13 as assertions;
rollback;
