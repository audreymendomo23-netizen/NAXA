-- Test d'intégration Replay — rappels de péremption, déduplication, date Cameroun et exclusion Marketplace.
begin;

do $test$
declare
  v_pharmacie uuid;
  v_promoteur uuid;
  v_gestionnaire uuid;
  v_produit uuid;
  v_today date:=private.naxa_date_cameroun();
  v_run text:=replace(gen_random_uuid()::text,'-','');
  v_lot_ids uuid[];
  v_expired_lot uuid;
  v_recipient_count integer;
  v_notifications integer;
  v_dispatches integer;
  v_first integer;
  v_second integer;
  v_marketplace_qty integer;
  v_batch integer;
  v_stock_price integer:=900;
begin
  if v_today is distinct from (now() at time zone 'Africa/Douala')::date then
    raise exception 'La date métier ne correspond pas à Africa/Douala';
  end if;

  select ph.id,pp.promoteur_id,a.profile_id
    into v_pharmacie,v_promoteur,v_gestionnaire
  from public.pharmacies ph
  join public.promoteur_pharmacies pp on pp.pharmacie_id=ph.id and pp.actif=true
  join public.profiles promoter on promoter.id=pp.promoteur_id
    and promoter.actif=true and promoter.role::text='promoteur'
  join public.naxa_professional_assignments a on a.pharmacie_id=ph.id
    and a.role_code='gestionnaire_stock'
    and a.statut='active' and a.commence_at<=now()
    and (a.expire_at is null or a.expire_at>now())
  join public.profiles staff on staff.id=a.profile_id and staff.actif=true
  where ph.actif=true and ph.est_demo=true and ph.archivee_le is null
  order by ph.nom
  limit 1;

  if v_pharmacie is null or v_promoteur is null or v_gestionnaire is null then
    raise exception 'Fixture Replay Promoteur + Gestionnaire Stock active indisponible';
  end if;

  select p.id into v_produit
  from public.produits p
  where not exists (
    select 1 from public.stocks_lots l
    where l.pharmacie_id=v_pharmacie and l.produit_id=p.id
  )
  limit 1;
  if v_produit is null then raise exception 'Aucun produit sans lot disponible pour le test transactionnel'; end if;

  select count(distinct recipient_id)::integer into v_recipient_count
  from (
    select pp.promoteur_id as recipient_id
    from public.promoteur_pharmacies pp
    join public.profiles p on p.id=pp.promoteur_id and p.actif=true and p.role::text='promoteur'
    where pp.pharmacie_id=v_pharmacie and pp.actif=true
    union
    select a.profile_id
    from public.naxa_professional_assignments a
    join public.profiles p on p.id=a.profile_id and p.actif=true
    where a.pharmacie_id=v_pharmacie
      and a.role_code in ('responsable','gestionnaire_stock')
      and a.statut='active' and a.commence_at<=now()
      and (a.expire_at is null or a.expire_at>now())
  ) recipients;

  if v_recipient_count<2 then
    raise exception 'Le test exige au moins Promoteur et Gestionnaire Stock actifs';
  end if;

  update public.pharmacies set est_demo=false where id=v_pharmacie;
  perform set_config('naxa.stock_actor_id',v_gestionnaire::text,true);

  insert into public.stocks(pharmacie_id,produit_id,prix,quantite,date_peremption,updated_at)
  values(v_pharmacie,v_produit,v_stock_price,1049,v_today+90,now())
  on conflict(pharmacie_id,produit_id) do update
    set prix=excluded.prix,quantite=excluded.quantite,
        date_peremption=excluded.date_peremption,updated_at=now();

  insert into public.stocks_lots(
    pharmacie_id,produit_id,lot,numero_lot,peremption,date_peremption,quantite,bloque
  )
  select v_pharmacie,v_produit,
    'NAXA-E2E-EXP-'||v_run||'-'||d.days,
    'NAXA-E2E-EXP-'||v_run||'-'||d.days,
    v_today+d.days,v_today+d.days,
    case when d.days=-1 then 999 else 10 end,
    false
  from (values (30),(15),(7),(3),(0),(-1)) as d(days);

  select array_agg(l.id order by l.date_peremption desc)
    into v_lot_ids
  from public.stocks_lots l
  where l.pharmacie_id=v_pharmacie and l.produit_id=v_produit
    and l.numero_lot like 'NAXA-E2E-EXP-'||v_run||'-%';

  select l.id into v_expired_lot
  from public.stocks_lots l
  where l.pharmacie_id=v_pharmacie and l.produit_id=v_produit
    and l.numero_lot='NAXA-E2E-EXP-'||v_run||'-'||(-1);

  if cardinality(v_lot_ids)<>6 or v_expired_lot is null then
    raise exception 'Fixture de six lots incomplète';
  end if;

  select o.quantite into v_marketplace_qty
  from public.marketplace_offre_stock_disponible(v_pharmacie,v_produit) o;
  if coalesce(v_marketplace_qty,-1)<>50 then
    raise exception 'Le Marketplace doit compter les cinq lots valides (50), jamais le lot périmé (999) ; obtenu %',v_marketplace_qty;
  end if;

  -- Une seule fiche/lot est traitée par appel : les passages suivants doivent avancer
  -- vers les lots suivants au lieu de retenter indéfiniment le premier lot déjà notifié.
  v_first:=0;
  for v_batch in 1..6 loop
    v_first:=v_first+private.dispatch_pharmacy_lot_expiry_alerts(v_today,1);
  end loop;
  if v_first<>5*v_recipient_count then
    raise exception 'Nombre de rappels inattendu après traitement par lots : % créés, % attendus',v_first,5*v_recipient_count;
  end if;

  v_second:=private.dispatch_pharmacy_lot_expiry_alerts(v_today,1);
  if v_second<>0 then
    raise exception 'Le passage suivant doit être idempotent ; % doublon(s) créé(s)',v_second;
  end if;

  select count(*)::integer into v_dispatches
  from private.pharmacy_lot_expiry_notification_dispatches d
  where d.lot_id=any(v_lot_ids);
  if v_dispatches<>5*v_recipient_count then
    raise exception 'Table de déduplication incohérente : % lignes',v_dispatches;
  end if;

  select count(*)::integer into v_notifications
  from public.notifications n
  where n.type='lot_expiry_reminder' and n.related_entity_id=any(v_lot_ids);
  if v_notifications<>5*v_recipient_count then
    raise exception 'Notifications incohérentes : % lignes',v_notifications;
  end if;

  if exists(
    select 1
    from public.notifications n
    join public.naxa_professional_assignments a on a.profile_id=n.user_id
    where n.type='lot_expiry_reminder'
      and n.related_entity_id=any(v_lot_ids)
      and a.pharmacie_id=v_pharmacie
      and a.role_code in ('caisse','livreur')
  ) then
    raise exception 'Un compte Caisse ou Livreur ne doit pas recevoir les rappels de péremption';
  end if;

  if exists(
    select 1 from public.notifications n
    where n.type='lot_expiry_reminder' and n.related_entity_id=v_expired_lot
  ) then
    raise exception 'Un lot déjà périmé (J+1) ne doit pas générer un rappel préventif';
  end if;

  update public.stocks_lots
  set quantite=0
  where id=any(v_lot_ids) and date_peremption>=v_today;

  select o.quantite into v_marketplace_qty
  from public.marketplace_offre_stock_disponible(v_pharmacie,v_produit) o;
  if coalesce(v_marketplace_qty,-1)<>0 then
    raise exception 'Un lot périmé seul ne doit jamais maintenir une offre Marketplace ; obtenu %',v_marketplace_qty;
  end if;

  if exists(
    select 1
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname,p.proname) in (
      ('private','marketplace_offre_stock_disponible'),
      ('private','marketplace_offre_stock_disponible_guarded'),
      ('private','naxa_pos_debit_stock'),
      ('private','reserve_stock'),
      ('public','client_credit_demande_decider'),
      ('public','fournisseur_reception_enregistrer'),
      ('public','gestionnaire_stock_reservation_confirmer'),
      ('public','gestionnaire_stock_transfert_atomique'),
      ('public','vente_reservation_credit_finaliser')
    )
    and pg_get_functiondef(p.oid) ~ '\mcurrent_date\M'
    and pg_get_functiondef(p.oid) ilike '%date_peremption%'
  ) then
    raise exception 'Une garde de péremption dépend encore de current_date UTC';
  end if;

  if not exists(
    select 1 from cron.job
    where jobname='naxa-pharmacy-lot-expiry-notifications'
      and schedule='*/10 * * * *'
      and active=true
  ) then
    raise exception 'Le job batch toutes les 10 minutes de rappels J-30/J-15/J-7/J-3/J0 est absent ou inactif';
  end if;
end;
$test$;

rollback;

select 'PASS — cinq seuils de rappel, destinataires Promoteur/Responsable/Gestionnaire Stock, aucun Caisse/Livreur, aucune répétition, lot J+1 exclu du Marketplace, date Africa/Douala, cron batch toutes les 10 minutes. Toutes les fixtures de test sont annulées.' as result;
