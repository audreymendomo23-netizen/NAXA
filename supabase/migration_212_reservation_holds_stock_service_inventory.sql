-- NAXA 212 — reservations as temporary holds + stock service inventory.
-- Additive and compatible with the live legacy reservation schema.
begin;

alter table public.reservations
  add column if not exists stock_decremented boolean not null default true,
  add column if not exists stock_restored boolean not null default false,
  add column if not exists consumed_by_vente_id uuid,
  add column if not exists consumed_at timestamptz;

comment on column public.reservations.stock_decremented is
  'Legacy compatibility: true only for reservations created by the old implementation that physically decremented stocks.';
comment on column public.reservations.stock_restored is
  'Idempotency guard for restoring physical stock for a legacy reservation.';
comment on column public.reservations.consumed_by_vente_id is
  'Cash-register sale UUID that consumed this reservation; populated by the sale-finalization transaction.';
comment on column public.reservations.consumed_at is
  'Timestamp when a cash-register sale consumed this reservation.';

create or replace function private.reserve_stock(p_pharmacie uuid, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  v_id uuid;
  it jsonb;
  v_total integer := 0;
  v_prix integer;
  v_q integer;
  v_produit uuid;
  v_stock integer;
  v_reserved integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not exists(select 1 from public.pharmacies where id=p_pharmacie and actif) then
    raise exception 'Pharmacie indisponible';
  end if;
  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 10 then
    raise exception 'Panier invalide';
  end if;
  if exists(
    select 1
    from (select value->>'produit_id' pid, count(*) n
          from jsonb_array_elements(p_items) group by value->>'produit_id') x
    where x.n > 1
  ) then raise exception 'Produit dupliqué dans le panier'; end if;

  -- Lock products in deterministic order to serialize concurrent reservations
  -- against both other reservations and cash-register stock mutations.
  for it in
    select value from jsonb_array_elements(p_items)
    order by (value->>'produit_id')::uuid
  loop
    v_produit := (it->>'produit_id')::uuid;
    v_q := coalesce((it->>'quantite')::integer, 1);
    if v_q < 1 or v_q > 10 then raise exception 'Quantité invalide'; end if;

    select s.quantite, s.prix into v_stock, v_prix
    from public.stocks s
    where s.pharmacie_id=p_pharmacie and s.produit_id=v_produit
      and (s.date_peremption is null or s.date_peremption >= current_date)
    for update;
    if not found then raise exception 'Produit absent ou périmé'; end if;

    select coalesce(sum(ri.quantite),0)::integer into v_reserved
    from public.reservation_items ri
    join public.reservations r on r.id=ri.reservation_id
    where r.pharmacie_id=p_pharmacie
      and ri.produit_id=v_produit
      and r.statut in ('en_attente','confirmee')
      and r.expires_at > now()
      and r.consumed_at is null
      and r.stock_restored = false;

    if v_stock - v_reserved < v_q then
      raise exception 'Stock disponible insuffisant après réservations actives';
    end if;
    v_total := v_total + v_prix * v_q;
  end loop;

  insert into public.reservations(client_id,pharmacie_id,expires_at,stock_decremented,stock_restored)
  values(auth.uid(),p_pharmacie,now()+interval '3 hours',false,false)
  returning id into v_id;

  for it in
    select value from jsonb_array_elements(p_items)
    order by (value->>'produit_id')::uuid
  loop
    v_produit := (it->>'produit_id')::uuid;
    v_q := coalesce((it->>'quantite')::integer,1);
    select s.prix into v_prix from public.stocks s
      where s.pharmacie_id=p_pharmacie and s.produit_id=v_produit;
    insert into public.reservation_items(reservation_id,produit_id,quantite,prix_unitaire)
    values(v_id,v_produit,v_q,v_prix);
  end loop;

  update public.reservations set total=v_total where id=v_id;
  return v_id;
end;
$function$;

create or replace function public.restore_stock(p_resa uuid)
returns void
language plpgsql
security definer
set search_path = 'public'
as $function$
declare r public.reservations%rowtype;
begin
  select * into r from public.reservations where id=p_resa for update;
  if not found then raise exception 'Réservation introuvable'; end if;

  -- New reservations never changed physical stock. Only restore legacy holds,
  -- once, and never after a sale has consumed the reservation.
  if r.stock_decremented and not r.stock_restored and r.consumed_at is null then
    update public.stocks s
      set quantite=s.quantite+ri.quantite, updated_at=now()
    from public.reservation_items ri
    where ri.reservation_id=p_resa
      and s.pharmacie_id=r.pharmacie_id
      and s.produit_id=ri.produit_id;

    update public.reservations
      set stock_restored=true, stock_decremented=false
      where id=p_resa;
  end if;
end;
$function$;

create or replace function public.marketplace_offre_stock_disponible(
  p_pharmacie uuid,
  p_produit uuid
)
returns table(prix integer, quantite integer)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_stock public.stocks%rowtype;
  v_has_lots boolean;
  v_physique integer;
  v_reserved integer;
begin
  if p_pharmacie is null or p_produit is null then return; end if;

  select s.* into v_stock
  from public.stocks s
  join public.pharmacies ph on ph.id=s.pharmacie_id
  where s.pharmacie_id=p_pharmacie and s.produit_id=p_produit
    and ph.actif=true and ph.visible_recherche=true;
  if not found then return; end if;

  select coalesce(sum(ri.quantite),0)::integer into v_reserved
  from public.reservation_items ri
  join public.reservations r on r.id=ri.reservation_id
  where r.pharmacie_id=p_pharmacie and ri.produit_id=p_produit
    and r.statut in ('en_attente','confirmee')
    and r.expires_at>now()
    and r.consumed_at is null
    and r.stock_restored=false;

  select exists(select 1 from public.stocks_lots l
    where l.pharmacie_id=p_pharmacie and l.produit_id=p_produit)
    into v_has_lots;

  if v_has_lots then
    -- Live schema currently uses legacy lot columns (peremption, no lot id/bloque).
    select coalesce(sum(l.quantite),0)::integer into v_physique
    from public.stocks_lots l
    where l.pharmacie_id=p_pharmacie and l.produit_id=p_produit
      and (l.peremption is null or l.peremption>=current_date);
  else
    v_physique := case
      when v_stock.date_peremption is null or v_stock.date_peremption>=current_date
        then greatest(coalesce(v_stock.quantite,0),0)
      else 0
    end;
  end if;

  return query select v_stock.prix,greatest(coalesce(v_physique,0)-coalesce(v_reserved,0),0);
end;
$function$;

revoke all on function public.marketplace_offre_stock_disponible(uuid,uuid) from public;
grant execute on function public.marketplace_offre_stock_disponible(uuid,uuid) to anon,authenticated;

-- A service session belongs to one stock manager and one pharmacy.
create table if not exists public.stock_service_sessions (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  gestionnaire_id uuid not null references auth.users(id) on delete restrict,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_note text,
  closing_note text,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  constraint stock_service_session_close_check check (
    (status='open' and closed_at is null) or (status='closed' and closed_at is not null)
  )
);

create unique index if not exists stock_service_one_open_per_manager
  on public.stock_service_sessions(pharmacie_id,gestionnaire_id) where status='open';

create table if not exists public.stock_service_inventory_counts (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.stock_service_sessions(id) on delete cascade,
  phase text not null check (phase in ('opening','closing')),
  produit_id uuid not null references public.produits(id) on delete restrict,
  expected_quantity integer not null check (expected_quantity >= 0),
  counted_quantity integer check (counted_quantity >= 0),
  variance integer generated always as (counted_quantity-expected_quantity) stored,
  counted_by uuid references auth.users(id) on delete set null,
  counted_at timestamptz,
  unique(session_id,phase,produit_id)
);

create index if not exists stock_service_counts_session_phase
  on public.stock_service_inventory_counts(session_id,phase);

alter table public.stock_service_sessions enable row level security;
alter table public.stock_service_inventory_counts enable row level security;

drop policy if exists stock_service_sessions_read_scope on public.stock_service_sessions;
create policy stock_service_sessions_read_scope on public.stock_service_sessions
  for select to authenticated using (
    gestionnaire_id=auth.uid()
    or private.is_admin()
    or private.naxa_scope_allows(auth.uid(),pharmacie_id,'PHARMACIE')
  );

drop policy if exists stock_service_counts_read_scope on public.stock_service_inventory_counts;
create policy stock_service_counts_read_scope on public.stock_service_inventory_counts
  for select to authenticated using (
    exists(select 1 from public.stock_service_sessions s
      where s.id=session_id and (
        s.gestionnaire_id=auth.uid() or private.is_admin()
        or private.naxa_scope_allows(auth.uid(),s.pharmacie_id,'PHARMACIE')
      ))
  );

create or replace function public.stock_service_open(p_pharmacie uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if not (private.is_admin() or private.naxa_scope_allows(auth.uid(),p_pharmacie,'PHARMACIE')) then
    raise exception 'Accès refusé à cette pharmacie';
  end if;

  insert into public.stock_service_sessions(pharmacie_id,gestionnaire_id,opening_note)
  values(p_pharmacie,auth.uid(),left(nullif(trim(p_note),''),500))
  returning id into v_id;

  insert into public.stock_service_inventory_counts(session_id,phase,produit_id,expected_quantity)
  select v_id,'opening',s.produit_id,greatest(s.quantite,0)
  from public.stocks s where s.pharmacie_id=p_pharmacie;

  return v_id;
exception when unique_violation then
  raise exception 'Une prise de service est déjà ouverte pour ce gestionnaire dans cette pharmacie';
end;
$function$;

create or replace function public.stock_service_record_count(
  p_session uuid,
  p_phase text,
  p_counts jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare v_session public.stock_service_sessions%rowtype; it jsonb; v_product uuid; v_count integer; v_expected integer; v_written integer:=0;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_phase not in ('opening','closing') then raise exception 'Phase d’inventaire invalide'; end if;
  if jsonb_typeof(p_counts)<>'array' or jsonb_array_length(p_counts)>5000 then
    raise exception 'Liste de comptage invalide';
  end if;

  select * into v_session from public.stock_service_sessions where id=p_session for update;
  if not found then raise exception 'Session introuvable'; end if;
  if v_session.gestionnaire_id<>auth.uid() and not private.is_admin() then
    raise exception 'Seul le gestionnaire responsable peut saisir cet inventaire';
  end if;
  if v_session.status<>'open' then raise exception 'Session de service déjà clôturée'; end if;
  if p_phase='closing' and exists(select 1 from public.stock_service_inventory_counts
    where session_id=p_session and phase='opening' and counted_quantity is null) then
    raise exception 'Terminez d’abord le comptage de prise de service';
  end if;

  for it in select value from jsonb_array_elements(p_counts) loop
    v_product := (it->>'produit_id')::uuid;
    v_count := (it->>'quantite_comptee')::integer;
    if v_count is null or v_count<0 then raise exception 'Quantité comptée invalide'; end if;

    select c.expected_quantity into v_expected
    from public.stock_service_inventory_counts c
    where c.session_id=p_session and c.phase=p_phase and c.produit_id=v_product
    for update;

    if not found then
      if not exists(select 1 from public.stocks s
        where s.pharmacie_id=v_session.pharmacie_id and s.produit_id=v_product) then
        raise exception 'Produit hors stock de cette pharmacie';
      end if;
      select greatest(s.quantite,0) into v_expected from public.stocks s
        where s.pharmacie_id=v_session.pharmacie_id and s.produit_id=v_product;
      insert into public.stock_service_inventory_counts(session_id,phase,produit_id,expected_quantity,counted_quantity,counted_by,counted_at)
      values(p_session,p_phase,v_product,v_expected,v_count,auth.uid(),now());
    else
      update public.stock_service_inventory_counts
        set counted_quantity=v_count,counted_by=auth.uid(),counted_at=now()
        where session_id=p_session and phase=p_phase and produit_id=v_product;
    end if;
    v_written:=v_written+1;
  end loop;
  return v_written;
end;
$function$;

create or replace function public.stock_service_close(p_session uuid,p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare s public.stock_service_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into s from public.stock_service_sessions where id=p_session for update;
  if not found then raise exception 'Session introuvable'; end if;
  if s.gestionnaire_id<>auth.uid() and not private.is_admin() then raise exception 'Accès refusé'; end if;
  if s.status<>'open' then raise exception 'Session déjà clôturée'; end if;
  if exists(select 1 from public.stock_service_inventory_counts
    where session_id=p_session and phase='opening' and counted_quantity is null) then
    raise exception 'Inventaire de prise de service incomplet';
  end if;

  insert into public.stock_service_inventory_counts(session_id,phase,produit_id,expected_quantity)
  select p_session,'closing',st.produit_id,greatest(st.quantite,0)
  from public.stocks st
  where st.pharmacie_id=s.pharmacie_id
  on conflict(session_id,phase,produit_id) do nothing;

  if exists(select 1 from public.stock_service_inventory_counts
    where session_id=p_session and phase='closing' and counted_quantity is null) then
    raise exception 'Renseignez les quantités comptées de fin de service avant clôture';
  end if;

  update public.stock_service_sessions
  set status='closed',closed_at=now(),closing_note=left(nullif(trim(p_note),''),500)
  where id=p_session;
end;
$function$;

revoke all on function public.stock_service_open(uuid,text) from public,anon;
revoke all on function public.stock_service_record_count(uuid,text,jsonb) from public,anon;
revoke all on function public.stock_service_close(uuid,text) from public,anon;
grant execute on function public.stock_service_open(uuid,text) to authenticated;
grant execute on function public.stock_service_record_count(uuid,text,jsonb) to authenticated;
grant execute on function public.stock_service_close(uuid,text) to authenticated;

commit;
