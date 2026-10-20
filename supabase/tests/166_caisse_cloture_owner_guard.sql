-- NAXA 166 — test de cloisonnement de la clôture par titulaire de session.
begin;

do $structure$
declare v_fn text;
begin
  select pg_get_functiondef(p.oid) into v_fn
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='caisse_cloturer' and p.pronargs=2;
  if v_fn is null
     or position('v_session.ouvert_par is distinct from auth.uid()' in lower(v_fn))=0
     or position('v_decaissements' in lower(v_fn))=0
     or position('caisse_decaissements' in lower(v_fn))=0 then
    raise exception 'Garde du titulaire ou calcul des décaissements absent de caisse_cloturer';
  end if;
end
$structure$;

do $behavior$
declare
  v_owner uuid := gen_random_uuid();
  v_other uuid := gen_random_uuid();
  v_pharmacie uuid := gen_random_uuid();
  v_caisse uuid := gen_random_uuid();
  v_session uuid := gen_random_uuid();
  v_rejected boolean := false;
begin
  set local session_replication_role = replica;
  insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
  values
    (v_owner,'authenticated','authenticated','naxa166_owner_'||substr(replace(v_owner::text,'-',''),1,10)||'@invalid.local','',now(),now()),
    (v_other,'authenticated','authenticated','naxa166_other_'||substr(replace(v_other::text,'-',''),1,10)||'@invalid.local','',now(),now());
  set local session_replication_role = origin;

  insert into public.profiles(id,role,username,actif,pharmacie_id)
  values
    (v_owner,'caisse','naxa166_owner_'||substr(replace(v_owner::text,'-',''),1,10),true,v_pharmacie),
    (v_other,'caisse','naxa166_other_'||substr(replace(v_other::text,'-',''),1,10),true,v_pharmacie);
  insert into public.pharmacies(id,nom,lat,lng,actif,visible_recherche)
  values(v_pharmacie,'NAXA TEST 166',3.8667,11.5167,true,true);
  insert into public.caisses(id,pharmacie_id,nom,actif)
  values(v_caisse,v_pharmacie,'Caisse test 166',true);
  insert into public.caisses_sessions(id,caisse_id,ouvert_par,fond_initial,statut)
  values(v_session,v_caisse,v_owner,500,'ouverte');

  perform set_config('request.jwt.claim.sub',v_other::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);
  begin
    perform * from public.caisse_cloturer(v_session,500);
  exception when others then v_rejected := true;
  end;
  if not v_rejected then raise exception 'Un autre compte Caisse a pu clôturer la session du titulaire'; end if;

  perform set_config('request.jwt.claim.sub',v_owner::text,true);
  perform * from public.caisse_cloturer(v_session,500);
  if not exists(select 1 from public.caisses_sessions where id=v_session and statut='cloturee' and cloture_par=v_owner) then
    raise exception 'Le titulaire n’a pas pu clôturer sa propre session';
  end if;
end
$behavior$;

select '166_caisse_cloture_owner_guard PASS' as resultat;
rollback;
