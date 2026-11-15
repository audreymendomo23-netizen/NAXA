-- NAXA — rappels automatiques de péremption et exclusion Marketplace selon la date camerounaise.
begin;

create or replace function private.naxa_date_cameroun()
returns date
language sql
stable
set search_path=''
as $function$
  select (now() at time zone 'Africa/Douala')::date;
$function$;
revoke all on function private.naxa_date_cameroun() from public,anon,authenticated,service_role;

create table if not exists private.pharmacy_lot_expiry_notification_dispatches (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  lot_id uuid not null references public.stocks_lots(id) on delete cascade,
  destinataire_id uuid not null references auth.users(id) on delete cascade,
  date_peremption date not null,
  jours_avant integer not null check (jours_avant in (30,15,7,3,0)),
  notification_id uuid references public.notifications(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint pharmacy_lot_expiry_dispatch_unique
    unique (lot_id,date_peremption,jours_avant,destinataire_id)
);
alter table private.pharmacy_lot_expiry_notification_dispatches enable row level security;
revoke all on private.pharmacy_lot_expiry_notification_dispatches from public,anon,authenticated,service_role;

create index if not exists stocks_lots_expiry_dispatch_idx
  on public.stocks_lots(date_peremption,pharmacie_id,produit_id)
  where quantite>0;

create or replace function private.marketplace_offre_stock_disponible(p_pharmacie uuid,p_produit uuid)
returns table(prix integer,quantite integer)
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_stock public.stocks%rowtype;
  v_has_lots boolean;
  v_disponible integer;
  v_reserve integer;
  v_last_stock_update timestamptz;
  v_today date:=private.naxa_date_cameroun();
begin
  if p_pharmacie is null or p_produit is null then return; end if;

  select s.* into v_stock
  from public.stocks s
  join public.pharmacies ph on ph.id=s.pharmacie_id
  where s.pharmacie_id=p_pharmacie and s.produit_id=p_produit
    and ph.actif is true and ph.visible_recherche is true
    and ph.est_demo is false and ph.archivee_le is null;

  if not found then return; end if;

  v_last_stock_update:=private.marketplace_stock_last_quantity_update(p_pharmacie,p_produit);
  if v_last_stock_update is null or v_last_stock_update<now()-interval '48 hours' then return; end if;

  select exists(select 1 from public.stocks_lots l
    where l.pharmacie_id=p_pharmacie and l.produit_id=p_produit)
    into v_has_lots;

  if v_has_lots then
    select coalesce(sum(l.quantite),0)::integer into v_disponible
    from public.stocks_lots l
    where l.pharmacie_id=p_pharmacie and l.produit_id=p_produit
      and coalesce(l.bloque,false)=false
      and l.date_peremption>=v_today;
  else
    v_disponible:=case
      when v_stock.date_peremption is null or v_stock.date_peremption>=v_today
        then greatest(coalesce(v_stock.quantite,0),0)
      else 0
    end;
  end if;

  select coalesce(sum(ri.quantite),0)::integer into v_reserve
  from public.reservation_items ri
  join public.reservations r on r.id=ri.reservation_id
  where r.pharmacie_id=p_pharmacie and ri.produit_id=p_produit
    and r.mode in ('reservation','commande')
    and r.statut in ('en_attente','confirmee')
    and r.expires_at>now() and r.consumed_at is null
    and coalesce(r.stock_restored,false)=false
    and coalesce(r.stock_decremented,false)=false;

  return query select v_stock.prix,greatest(coalesce(v_disponible,0)-coalesce(v_reserve,0),0);
end;
$function$;

create or replace function private.marketplace_offre_stock_disponible_guarded(p_pharmacie uuid,p_produit uuid)
returns table(prix integer,quantite integer)
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_stock public.stocks%rowtype;
  v_has_lots boolean;
  v_disponible integer;
  v_reserve integer;
  v_last_stock_update timestamptz;
  v_today date:=private.naxa_date_cameroun();
begin
  if p_pharmacie is null or p_produit is null then return; end if;

  select s.* into v_stock
  from public.stocks s
  join public.pharmacies ph on ph.id=s.pharmacie_id
  where s.pharmacie_id=p_pharmacie and s.produit_id=p_produit
    and ph.actif is true and ph.visible_recherche is true
    and ph.est_demo is false and ph.archivee_le is null;

  if not found then return; end if;

  v_last_stock_update:=private.marketplace_stock_last_quantity_update(p_pharmacie,p_produit);
  if v_last_stock_update is null or v_last_stock_update<now()-interval '48 hours' then return; end if;

  select exists(select 1 from public.stocks_lots l
    where l.pharmacie_id=p_pharmacie and l.produit_id=p_produit)
    into v_has_lots;

  if v_has_lots then
    select coalesce(sum(l.quantite),0)::integer into v_disponible
    from public.stocks_lots l
    where l.pharmacie_id=p_pharmacie and l.produit_id=p_produit
      and coalesce(l.bloque,false)=false
      and l.date_peremption>=v_today;
  else
    v_disponible:=case
      when v_stock.date_peremption is null or v_stock.date_peremption>=v_today
        then greatest(coalesce(v_stock.quantite,0),0)
      else 0
    end;
  end if;

  select coalesce(sum(ri.quantite),0)::integer into v_reserve
  from public.reservation_items ri
  join public.reservations r on r.id=ri.reservation_id
  where r.pharmacie_id=p_pharmacie and ri.produit_id=p_produit
    and r.mode in ('reservation','commande')
    and r.statut in ('en_attente','confirmee')
    and r.expires_at>now() and r.consumed_at is null
    and coalesce(r.stock_restored,false)=false
    and coalesce(r.stock_decremented,false)=false;

  return query select v_stock.prix,greatest(coalesce(v_disponible,0)-coalesce(v_reserve,0),0);
end;
$function$;

do $date_guards$
declare
  v_fn record;
  v_definition text;
  v_updated integer:=0;
begin
  for v_fn in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where p.prokind='f'
      and (
        (n.nspname='private' and p.proname in (
          'naxa_pos_debit_stock','reserve_stock',
          'marketplace_offre_stock_disponible','marketplace_offre_stock_disponible_guarded'
        ))
        or
        (n.nspname='public' and p.proname in (
          'client_credit_demande_decider',
          'fournisseur_reception_enregistrer',
          'gestionnaire_stock_reservation_confirmer',
          'gestionnaire_stock_transfert_atomique',
          'vente_reservation_credit_finaliser'
        ))
      )
      and pg_get_functiondef(p.oid) ~ '\mcurrent_date\M'
      and pg_get_functiondef(p.oid) ilike '%date_peremption%'
  loop
    v_definition:=pg_get_functiondef(v_fn.oid);
    v_definition:=regexp_replace(v_definition,'\mcurrent_date\M','private.naxa_date_cameroun()','g');
    v_definition:=replace(
      v_definition,
      '(l.date_peremption is null or l.date_peremption>=private.naxa_date_cameroun())',
      'l.date_peremption>=private.naxa_date_cameroun()'
    );
    execute v_definition;
    v_updated:=v_updated+1;
  end loop;

  if v_updated<>7 then
    raise exception 'Mise à jour des gardes de péremption incomplète : % fonction(s) modifiée(s), 7 attendues',v_updated;
  end if;
end;
$date_guards$;

create or replace function private.dispatch_pharmacy_lot_expiry_alerts(p_today date,p_limit integer default 1000)
returns integer
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_lot record;
  v_recipient record;
  v_dispatch_id uuid;
  v_notification_id uuid;
  v_days integer;
  v_sent integer:=0;
  v_delay text;
  v_title text;
  v_body text;
begin
  if p_today is null or p_today is distinct from private.naxa_date_cameroun() then
    raise exception 'La date de traitement doit être la date locale Africa/Douala';
  end if;
  if p_limit is null or p_limit<1 or p_limit>2000 then
    raise exception 'Limite de traitement hors plage (1 à 2000 lots)';
  end if;

  for v_lot in
    select l.id,l.pharmacie_id,l.produit_id,l.numero_lot,l.date_peremption,
           l.quantite,l.bloque,p.nom as produit_nom,ph.nom as pharmacie_nom,
           (l.date_peremption-p_today)::integer as jours_avant
    from public.stocks_lots l
    join public.produits p on p.id=l.produit_id
    join public.pharmacies ph on ph.id=l.pharmacie_id
    where l.quantite>0
      and (l.date_peremption-p_today) in (30,15,7,3,0)
      and ph.actif=true
      and ph.est_demo=false
      and ph.archivee_le is null
    order by l.date_peremption,l.pharmacie_id,l.id
    limit p_limit
  loop
    v_days:=v_lot.jours_avant;
    v_delay:=case
      when v_days=0 then 'atteint sa date de péremption aujourd''hui'
      else 'atteint sa date de péremption dans J-'||v_days
    end;
    v_title:=case
      when v_days=0 then 'Péremption aujourd''hui · lot '||v_lot.numero_lot
      else 'Péremption dans J-'||v_days||' · lot '||v_lot.numero_lot
    end;
    v_body:='Pharmacie : '||v_lot.pharmacie_nom||
      ' · Produit : '||v_lot.produit_nom||
      ' · Lot : '||v_lot.numero_lot||
      ' · Quantité restante : '||v_lot.quantite::text||
      ' · Date de péremption : '||to_char(v_lot.date_peremption,'DD/MM/YYYY')||
      '. Ce lot '||v_delay||'. '||
      case when v_days=0
        then 'NAXA cessera de le compter comme vendable sur le Marketplace dès le lendemain à 00:00, heure du Cameroun. Vérifiez et gérez le lot dans votre pharmacie.'
        else 'Anticipez sa gestion dans votre pharmacie. NAXA ne valide pas les fiches ni les stocks déclarés par la pharmacie.'
      end||
      case when v_lot.bloque then ' Le lot est déjà marqué BLOQUÉ.' else '' end;

    for v_recipient in
      select r.destinataire_id,
             string_agg(distinct r.role_label,', ' order by r.role_label) as roles
      from (
        select pp.promoteur_id as destinataire_id,'Promoteur'::text as role_label
        from public.promoteur_pharmacies pp
        join public.profiles promoter on promoter.id=pp.promoteur_id
          and promoter.actif=true and promoter.role::text='promoteur'
        where pp.pharmacie_id=v_lot.pharmacie_id and pp.actif=true

        union all

        select a.profile_id as destinataire_id,
          case a.role_code
            when 'responsable' then 'Responsable'
            else 'Gestionnaire Stock'
          end as role_label
        from public.naxa_professional_assignments a
        join public.profiles staff on staff.id=a.profile_id and staff.actif=true
        where a.pharmacie_id=v_lot.pharmacie_id
          and a.role_code in ('responsable','gestionnaire_stock')
          and a.statut='active'
          and a.commence_at<=now()
          and (a.expire_at is null or a.expire_at>now())
      ) r
      group by r.destinataire_id
      order by r.destinataire_id
    loop
      v_dispatch_id:=null;
      v_notification_id:=null;

      insert into private.pharmacy_lot_expiry_notification_dispatches(
        pharmacie_id,lot_id,destinataire_id,date_peremption,jours_avant
      )
      values(
        v_lot.pharmacie_id,v_lot.id,v_recipient.destinataire_id,
        v_lot.date_peremption,v_days
      )
      on conflict(lot_id,date_peremption,jours_avant,destinataire_id) do nothing
      returning id into v_dispatch_id;

      if v_dispatch_id is not null then
        insert into public.notifications(user_id,type,titre,corps,related_entity_id)
        values(
          v_recipient.destinataire_id,
          'lot_expiry_reminder',
          v_title,
          v_body,
          v_lot.id
        )
        returning id into v_notification_id;

        update private.pharmacy_lot_expiry_notification_dispatches
        set notification_id=v_notification_id
        where id=v_dispatch_id;

        v_sent:=v_sent+1;
      end if;
    end loop;
  end loop;

  return v_sent;
end;
$function$;
revoke all on function private.dispatch_pharmacy_lot_expiry_alerts(date,integer) from public,anon,authenticated,service_role;

do $cron$
declare
  v_job record;
begin
  for v_job in
    select jobid from cron.job
    where jobname='naxa-pharmacy-lot-expiry-notifications'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;

  perform cron.schedule(
    'naxa-pharmacy-lot-expiry-notifications',
    '0 6 * * *',
    'select private.dispatch_pharmacy_lot_expiry_alerts(private.naxa_date_cameroun(),1000);'
  );
end;
$cron$;

commit;
