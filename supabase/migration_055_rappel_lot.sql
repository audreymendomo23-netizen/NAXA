-- NAXA ERP-011 — F64 Rappel de lot
-- Extension additive de stocks_lots : aucun moteur de stock concurrent.
-- Un rappel est un événement métier traçable ; le lot reste la source opérationnelle.
create table if not exists public.rappels_lots (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  lot_id uuid not null references public.stocks_lots(id) on delete restrict,
  reference_rappel text,
  motif text not null,
  statut text not null default 'actif' check (statut in ('actif','leve')),
  date_rappel timestamptz not null default now(),
  leve_at timestamptz,
  leve_par uuid references auth.users(id),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (lot_id),
  unique (pharmacie_id, reference_rappel)
);

alter table public.rappels_lots enable row level security;

drop policy if exists rappels_lots_scope_read on public.rappels_lots;
create policy rappels_lots_scope_read on public.rappels_lots
for select to authenticated
using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

revoke all on public.rappels_lots from anon, authenticated;
grant select on public.rappels_lots to authenticated;

create index if not exists rappels_lots_pharmacie_statut_idx
  on public.rappels_lots(pharmacie_id, statut, date_rappel desc);

create or replace function public.lot_rappeler(
  p_lot uuid,
  p_motif text,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_lot public.stocks_lots%rowtype;
  v_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if nullif(trim(coalesce(p_motif,'')), '') is null then
    raise exception 'Motif du rappel obligatoire';
  end if;

  select * into v_lot
  from public.stocks_lots
  where id=p_lot
  for update;

  if not found then raise exception 'Lot introuvable'; end if;
  if not (public.is_admin() or public.can_access_pharmacy(v_lot.pharmacie_id)) then
    raise exception 'Lot non autorisé';
  end if;

  if exists (
    select 1 from public.rappels_lots
    where lot_id=p_lot and statut='actif'
  ) then
    raise exception 'Ce lot fait déjà l''objet d''un rappel actif';
  end if;

  insert into public.rappels_lots(
    pharmacie_id, lot_id, reference_rappel, motif, created_by
  )
  values (
    v_lot.pharmacie_id, p_lot, nullif(trim(p_reference), ''),
    trim(p_motif), v_user
  )
  returning id into v_id;

  update public.stocks_lots
  set bloque=true,
      motif_blocage=trim(p_motif)
  where id=p_lot;

  return v_id;
end;
$$;

revoke all on function public.lot_rappeler(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.lot_rappeler(uuid,text,text) to authenticated;

create or replace function public.lot_lever_rappel(p_lot uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_pharmacie uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Connexion requise'; end if;

  select pharmacie_id into v_pharmacie
  from public.stocks_lots
  where id=p_lot
  for update;

  if v_pharmacie is null then raise exception 'Lot introuvable'; end if;
  if not (public.is_admin() or public.can_access_pharmacy(v_pharmacie)) then
    raise exception 'Lot non autorisé';
  end if;

  update public.rappels_lots
  set statut='leve', leve_at=now(), leve_par=v_user
  where lot_id=p_lot and statut='actif';

  update public.stocks_lots
  set bloque=false, motif_blocage=null
  where id=p_lot;
end;
$$;

revoke all on function public.lot_lever_rappel(uuid)
  from public, anon, authenticated;
grant execute on function public.lot_lever_rappel(uuid) to authenticated;

comment on table public.rappels_lots is
  'Traçabilité des rappels de lots ; un rappel actif bloque le lot via stocks_lots.';
