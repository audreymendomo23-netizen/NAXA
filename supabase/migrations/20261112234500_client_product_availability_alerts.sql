-- NAXA — demandes d'alerte de disponibilité et notification à la première offre vendable par pharmacie.
begin;

create table if not exists public.client_product_availability_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  produit_id uuid not null references public.produits(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,produit_id)
);
alter table public.client_product_availability_alerts enable row level security;
revoke all on public.client_product_availability_alerts from public,anon;
grant select on public.client_product_availability_alerts to authenticated;
grant all on public.client_product_availability_alerts to service_role;
drop policy if exists client_product_availability_alerts_read_own on public.client_product_availability_alerts;
create policy client_product_availability_alerts_read_own
  on public.client_product_availability_alerts for select to authenticated
  using (user_id=(select auth.uid()));

create table if not exists private.client_product_availability_state (
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  produit_id uuid not null references public.produits(id) on delete cascade,
  available boolean not null default false,
  checked_at timestamptz not null default now(),
  primary key(pharmacie_id,produit_id)
);
alter table private.client_product_availability_state enable row level security;
revoke all on private.client_product_availability_state from public,anon,authenticated,service_role;

create table if not exists private.client_product_availability_deliveries (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.client_product_availability_alerts(id) on delete cascade,
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  journal_id bigint not null references public.stock_manager_movement_journal(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(alert_id,pharmacie_id)
);
alter table private.client_product_availability_deliveries enable row level security;
revoke all on private.client_product_availability_deliveries from public,anon,authenticated,service_role;

create or replace function private.notify_client_product_availability()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_quantity integer;
  v_product_name text;
  v_pharmacy_name text;
  v_pharmacy_address text;
  v_price text;
  v_was_available boolean:=false;
  v_alert record;
  v_delivery uuid;
begin
  if new.source_table not in ('stocks','stocks_lots') then return new; end if;

  select coalesce(o.quantite,0),o.prix
    into v_quantity,v_price
  from public.marketplace_offre_stock_disponible(new.pharmacie_id,new.produit_id) o;

  insert into private.client_product_availability_state(pharmacie_id,produit_id,available)
  values(new.pharmacie_id,new.produit_id,false)
  on conflict(pharmacie_id,produit_id) do nothing;
  select s.available into v_was_available
  from private.client_product_availability_state s
  where s.pharmacie_id=new.pharmacie_id and s.produit_id=new.produit_id
  for update;

  if coalesce(v_quantity,0)<=0 then
    update private.client_product_availability_state
    set available=false,checked_at=now()
    where pharmacie_id=new.pharmacie_id and produit_id=new.produit_id;
    return new;
  end if;

  update private.client_product_availability_state
  set available=true,checked_at=now()
  where pharmacie_id=new.pharmacie_id and produit_id=new.produit_id;
  if coalesce(v_was_available,false) then return new; end if;

  select p.nom into v_product_name from public.produits p where p.id=new.produit_id;
  select ph.nom,concat_ws(', ',nullif(ph.adresse,''),nullif(ph.quartier,''),nullif(ph.ville,''))
    into v_pharmacy_name,v_pharmacy_address
  from public.pharmacies ph
  where ph.id=new.pharmacie_id and ph.actif=true and ph.visible_recherche=true
    and ph.archivee_le is null and ph.est_demo=false;
  if v_pharmacy_name is null then return new; end if;

  for v_alert in
    select a.id,a.user_id
    from public.client_product_availability_alerts a
    where a.produit_id=new.produit_id and a.active=true
  loop
    v_delivery:=null;
    insert into private.client_product_availability_deliveries(alert_id,pharmacie_id,journal_id)
    values(v_alert.id,new.pharmacie_id,new.id)
    on conflict(alert_id,pharmacie_id) do nothing
    returning id into v_delivery;

    if v_delivery is not null then
      insert into public.notifications(user_id,type,titre,corps,related_entity_id)
      values(
        v_alert.user_id,
        'product_availability',
        'Produit disponible chez un partenaire',
        coalesce(v_product_name,'Le produit recherché') || ' est maintenant disponible chez ' || v_pharmacy_name ||
          case when coalesce(v_pharmacy_address,'')<>'' then ' ('||v_pharmacy_address||')' else '' end ||
          case when v_price is not null then ' · Prix affiché : '||to_char(v_price,'FM999G999G990')||' FCFA' else '' end ||
          '. Ouvrez NAXA pour consulter l’offre et vérifier le stock avant votre déplacement.',
        new.produit_id
      );
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function private.notify_client_product_availability() from public,anon,authenticated,service_role;
drop trigger if exists trg_notify_client_product_availability on public.stock_manager_movement_journal;
create trigger trg_notify_client_product_availability
after insert on public.stock_manager_movement_journal
for each row execute function private.notify_client_product_availability();

commit;
