-- NAXA 242 — test comportemental de la création d’un hold sans débit physique.
begin;

do $structure$
declare v_fn text;
begin
  if to_regprocedure('private.reserve_stock(uuid,jsonb)') is null then
    raise exception 'La fonction interne de création des holds est absente';
  end if;
  if not has_function_privilege('authenticated','public.reserve_stock(uuid,jsonb)','EXECUTE')
     or has_function_privilege('anon','public.reserve_stock(uuid,jsonb)','EXECUTE') then
    raise exception 'Droits du point d’entrée de réservation incorrects';
  end if;
  select pg_get_functiondef('private.reserve_stock(uuid,jsonb)'::regprocedure) into v_fn;
  if position('stock_decremented,stock_restored' in replace(v_fn,' ',''))=0
     or position('false,false' in replace(v_fn,' ',''))=0
     or position('update public.stocks set quantite=quantite-' in lower(replace(v_fn,' ','')))>0 then
    raise exception 'La réservation doit créer un hold sans décrémenter le stock physique';
  end if;
end;
$structure$;

do $behavior$
declare
  v_user uuid := gen_random_uuid();
  v_reservation uuid;
  v_pharmacie uuid;
  v_produit uuid;
  v_stock_before integer;
  v_stock_after integer;
  v_cycle jsonb;
begin
  select s.pharmacie_id,s.produit_id,s.quantite
    into v_pharmacie,v_produit,v_stock_before
  from public.stocks s
  join public.pharmacies ph on ph.id=s.pharmacie_id and ph.actif=true
  where s.quantite >= 1
    and (s.date_peremption is null or s.date_peremption>=current_date)
    and s.quantite - coalesce((
      select sum(ri.quantite)::integer
      from public.reservation_items ri
      join public.reservations r on r.id=ri.reservation_id
      where r.pharmacie_id=s.pharmacie_id and ri.produit_id=s.produit_id
        and r.statut in ('en_attente','confirmee') and r.expires_at>now()
        and r.consumed_at is null and r.stock_restored=false and r.stock_decremented=false
    ),0) >= 1
  limit 1;
  if v_pharmacie is null or v_produit is null then
    raise exception 'Aucun stock partenaire disponible pour le test du hold';
  end if;

  set local session_replication_role = replica;
  insert into auth.users(id,aud,role,email,encrypted_password,created_at,updated_at)
  values(v_user,'authenticated','authenticated',
    'naxa242_hold_'||substr(replace(v_user::text,'-',''),1,12)||'@invalid.local','',now(),now());
  set local session_replication_role = origin;
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform set_config('request.jwt.claim.role','authenticated',true);

  v_reservation := public.reserve_stock(v_pharmacie,jsonb_build_array(
    jsonb_build_object('produit_id',v_produit,'quantite',1)
  ));
  if not exists(select 1 from public.reservations where id=v_reservation
      and stock_decremented=false and stock_restored=false and statut='en_attente') then
    raise exception 'La nouvelle réservation n’a pas été créée comme hold';
  end if;
  select quantite into v_stock_after from public.stocks
  where pharmacie_id=v_pharmacie and produit_id=v_produit;
  if v_stock_after is distinct from v_stock_before then
    raise exception 'La création du hold a décrémenté le stock physique';
  end if;

  update public.reservations set expires_at=now()-interval '1 minute' where id=v_reservation;
  v_cycle := public.reservation_lifecycle_cron();
  if coalesce((v_cycle->>'ok')::boolean,false) is not true then
    raise exception 'Le cycle a échoué sur un hold moderne : %',v_cycle;
  end if;
  if not exists(select 1 from public.reservations where id=v_reservation and statut='expiree') then
    raise exception 'Le hold arrivé à échéance n’a pas été expiré';
  end if;
  select quantite into v_stock_after from public.stocks
  where pharmacie_id=v_pharmacie and produit_id=v_produit;
  if v_stock_after is distinct from v_stock_before then
    raise exception 'L’expiration du hold a modifié le stock physique';
  end if;

  perform public.reservation_lifecycle_cron();
  select quantite into v_stock_after from public.stocks
  where pharmacie_id=v_pharmacie and produit_id=v_produit;
  if v_stock_after is distinct from v_stock_before then
    raise exception 'Le second passage a modifié le stock physique';
  end if;
end;
$behavior$;

select '242_marketplace_hold_reservation_alignment PASS' as resultat;
rollback;
