-- NAXA — notifications téléphoniques pour les changements de mission visibles par l'équipe pharmacie.
begin;

create table if not exists private.naxa_delivery_event_notification_dedup (
  event_id uuid not null references public.naxa_delivery_events(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(event_id,recipient_user_id)
);
alter table private.naxa_delivery_event_notification_dedup enable row level security;
revoke all on private.naxa_delivery_event_notification_dedup from public,anon,authenticated,service_role;

create or replace function private.naxa_delivery_notify_pharmacy_team()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_title text;
  v_body text;
  v_recipient uuid;
begin
  -- Les positions GPS ne déclenchent pas de push : elles sont trop fréquentes.
  if new.event_type='location' then return new; end if;

  v_title:=case new.event_type
    when 'ready' then 'Commande prête pour livraison'
    when 'accepted' then 'Livreur affecté à une commande'
    when 'picked_up' then 'Commande retirée par le livreur'
    when 'arrived' then 'Livreur arrivé à destination'
    when 'delivered' then 'Livraison confirmée'
    when 'failed' then 'Incident de livraison'
    when 'reoffered' then 'Livraison remise à disposition'
    when 'cancelled' then 'Livraison annulée'
    else 'Mise à jour de livraison'
  end;
  v_body:=left(coalesce(nullif(trim(new.label),''),'Le statut d''une livraison a changé.')
    ||case when nullif(trim(new.detail),'') is not null then ' — '||trim(new.detail) else '' end,950);

  for v_recipient in
    select targets.user_id
    from (
      select a.profile_id as user_id
      from public.naxa_professional_assignments a
      join public.profiles p on p.id=a.profile_id and p.actif=true
      where a.pharmacie_id=new.pharmacie_id
        and a.role_code in ('responsable','gestionnaire_stock','pharmacien')
        and a.statut='active' and a.commence_at<=now()
        and (a.expire_at is null or a.expire_at>now())
      union
      select pp.promoteur_id
      from public.promoteur_pharmacies pp
      join public.profiles p on p.id=pp.promoteur_id and p.actif=true
      where pp.pharmacie_id=new.pharmacie_id and pp.actif=true
    ) targets
    where targets.user_id is not null
  loop
    insert into private.naxa_delivery_event_notification_dedup(event_id,recipient_user_id)
    values(new.id,v_recipient)
    on conflict(event_id,recipient_user_id) do nothing;

    if found then
      insert into public.notifications(
        user_id,type,titre,corps,reservation_id,related_entity_id
      ) values(
        v_recipient,'delivery_status',v_title,v_body,new.reservation_id,new.mission_id
      );
    end if;
  end loop;

  return new;
end;
$$;
revoke all on function private.naxa_delivery_notify_pharmacy_team() from public,anon,authenticated,service_role;
drop trigger if exists trg_naxa_delivery_notify_pharmacy_team on public.naxa_delivery_events;
create trigger trg_naxa_delivery_notify_pharmacy_team
after insert on public.naxa_delivery_events
for each row execute function private.naxa_delivery_notify_pharmacy_team();

commit;
