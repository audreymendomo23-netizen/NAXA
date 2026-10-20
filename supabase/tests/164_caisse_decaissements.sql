-- NAXA 164 — tests structurels et comportementaux des décaissements de caisse.
begin;

do $structure$
declare
  v_fn text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='caisse_decaissements' and column_name='montant'
  ) then raise exception 'Table caisse_decaissements absente'; end if;

  select pg_get_functiondef(p.oid) into v_fn
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='caisse_decaisser' and p.pronargs=6;
  if v_fn is null
     or position('auth.uid()' in lower(v_fn))=0
     or position('p_session' in lower(v_fn))=0
     or position('p_montant' in lower(v_fn))=0
     or position('p_motif' in lower(v_fn))=0
     or position('ouvert_par' in lower(v_fn))=0
     or position('profiles' in lower(v_fn))=0 then
    raise exception 'Garde de session, rôle, montant ou motif du décaissement incomplet';
  end if;

  if not has_function_privilege('authenticated','public.caisse_decaisser(uuid,integer,text,text,text,uuid)','EXECUTE')
     or has_function_privilege('anon','public.caisse_decaisser(uuid,integer,text,text,text,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.caisse_decaisser(uuid,integer,text,text,text)','EXECUTE') then
    raise exception 'Droits EXECUTE de caisse_decaisser incorrects';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid='public.caisse_decaissements'::regclass
      and tgname='trg_caisse_audit_decaissements' and not tgisinternal
  ) then raise exception 'Déclencheur d’audit des décaissements absent'; end if;
end
$structure$;

do $behavior$
declare
  v_admin uuid := gen_random_uuid();
  v_pharmacie uuid := gen_random_uuid();
  v_caisse uuid := gen_random_uuid();
  v_session uuid := gen_random_uuid();
  v_mouvement uuid;
  v_grant uuid := gen_random_uuid();
  v_result record;
  v_count integer;
  v_rejected boolean := false;
begin
  set local session_replication_role = replica;
  insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
  values(v_admin,'authenticated','authenticated','naxa164_'||substr(replace(v_admin::text,'-',''),1,12)||'@invalid.local','',now(),now());
  set local session_replication_role = origin;

  insert into public.pharmacies(id,nom,lat,lng,actif,visible_recherche)
  values(v_pharmacie,'NAXA TEST 164',3.8667,11.5167,true,true);
  insert into public.profiles(id,role,username,actif,pharmacie_id)
  values(v_admin,'caisse','naxa164_'||substr(replace(v_admin::text,'-',''),1,12),true,v_pharmacie);
  insert into public.promoteur_pharmacies(promoteur_id,pharmacie_id,actif) values(v_admin,v_pharmacie,true);
  insert into public.caisses(id,pharmacie_id,nom,actif)
  values(v_caisse,v_pharmacie,'Caisse test 164',true);
  insert into public.caisses_sessions(id,caisse_id,ouvert_par,fond_initial,statut)
  values(v_session,v_caisse,v_admin,1000,'ouverte');

  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  insert into public.caisse_decaissement_auth_grants(id,user_id,session_id,method,expires_at)
  values(v_grant,v_admin,v_session,'pin',now()+interval '1 minute');
  v_mouvement := public.caisse_decaisser(v_session,200,'depense','Achat de fournitures','REC-164',v_grant);
  if not exists (
    select 1 from public.caisse_decaissements
    where id=v_mouvement and pharmacie_id=v_pharmacie and caisse_session_id=v_session
      and montant=200 and categorie='depense' and motif='Achat de fournitures'
      and justificatif_ref='REC-164' and created_by=v_admin
  ) then raise exception 'Le décaissement n’a pas été enregistré correctement'; end if;

  select count(*) into v_count from public.caisse_audit_events
  where entity_type='caisse_decaissements' and entity_id=v_mouvement and operation='INSERT';
  if v_count <> 1 then raise exception 'Le décaissement n’a pas laissé une trace dans le journal chaîné'; end if;

  v_rejected := false;
  begin
    perform public.caisse_decaisser(v_session,0,'depense','Montant invalide',null,gen_random_uuid());
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Un décaissement nul a été accepté'; end if;

  v_rejected := false;
  begin
    perform public.caisse_decaisser(v_session,50,'depense','non',null,gen_random_uuid());
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Un motif trop court a été accepté'; end if;

  select * into v_result from public.caisse_cloturer(v_session,800);
  if v_result.total_theorique <> 800 or v_result.total_compte <> 800 or v_result.ecart <> 0 then
    raise exception 'Le rapprochement n’intègre pas le décaissement : théorique %, compté %, écart %',
      v_result.total_theorique,v_result.total_compte,v_result.ecart;
  end if;

  v_rejected := false;
  begin
    perform public.caisse_decaisser(v_session,50,'autre','Après clôture',null,gen_random_uuid());
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Un décaissement après clôture a été accepté'; end if;
end
$behavior$;

select '164_caisse_decaissements PASS' as resultat;
rollback;
