-- NAXA — dispatch en lots successifs sans répéter les notifications déjà expédiées.
begin;

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
      and exists (
        select 1
        from (
          select pp.promoteur_id as destinataire_id
          from public.promoteur_pharmacies pp
          join public.profiles promoter on promoter.id=pp.promoteur_id
            and promoter.actif=true and promoter.role::text='promoteur'
          where pp.pharmacie_id=l.pharmacie_id and pp.actif=true

          union

          select a.profile_id as destinataire_id
          from public.naxa_professional_assignments a
          join public.profiles staff on staff.id=a.profile_id and staff.actif=true
          where a.pharmacie_id=l.pharmacie_id
            and a.role_code in ('responsable','gestionnaire_stock')
            and a.statut='active'
            and a.commence_at<=now()
            and (a.expire_at is null or a.expire_at>now())
        ) recipients
        where not exists (
          select 1
          from private.pharmacy_lot_expiry_notification_dispatches d
          where d.lot_id=l.id
            and d.date_peremption=l.date_peremption
            and d.jours_avant=(l.date_peremption-p_today)
            and d.destinataire_id=recipients.destinataire_id
        )
      )
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

  -- Répétition toutes les 10 minutes : la requête ignore les lots déjà servis
  -- à tous leurs destinataires et progresse donc vers les lots suivants.
  perform cron.schedule(
    'naxa-pharmacy-lot-expiry-notifications',
    '*/10 * * * *',
    'select private.dispatch_pharmacy_lot_expiry_alerts(private.naxa_date_cameroun(),1000);'
  );
end;
$cron$;

commit;
