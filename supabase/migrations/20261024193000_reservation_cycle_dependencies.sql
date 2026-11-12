-- NAXA 240 — dépendances explicites du cycle réservation dans le replay versionné.
-- Répare les écarts où les anciennes migrations 189/200/209/212 existent seulement à la racine.
-- Additif, idempotent, sans toucher aux quantités ni réconcilier des stocks historiques.
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

-- Preview bootstrap: restore the canonical authorization helper required by the reservation-item RLS policy.
-- Keep Promoteur validity tied to an active convention and subscription before granting pharmacy scope.
create schema if not exists private;

create or replace function private.naxa_promoteur_valide(p_promoteur uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $validity$
  select exists (
    select 1
    from public.profiles p
    join public.conventions_promoteurs c on c.promoteur_id=p.id
    join public.abonnements_promoteurs a
      on a.promoteur_id=p.id and a.convention_id=c.id
    where p.id=p_promoteur
      and p.role::text='promoteur'
      and p.actif=true
      and c.statut='active'
      and c.date_expiration>=current_date
      and c.architecture_code is not null
      and a.statut='actif'
      and a.echeance>=current_date
      and exists (
        select 1 from public.promoteur_pharmacies pp
        join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true
        where pp.promoteur_id=p.id and pp.actif=true
      )
      and not exists (
        select 1
        from public.promoteur_pharmacies pp
        left join public.pharmacies ph on ph.id=pp.pharmacie_id
        where pp.promoteur_id=p.id
          and pp.actif=true
          and (ph.id is null or ph.actif is not true)
      )
  );
$validity$;

revoke all on function private.naxa_promoteur_valide(uuid) from public, anon, authenticated, service_role;

create or replace function public.naxa_scope_allows(
  p_profile uuid,
  p_pharmacie uuid,
  p_scope text default 'PHARMACIE'
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $scope$
  with recursive ancestors(id,parent_profile_id,role,actif,depth) as (
    select p.id,p.parent_profile_id,p.role::text,p.actif,0
    from public.profiles p
    where p.id=p_profile
    union all
    select parent.id,parent.parent_profile_id,parent.role::text,parent.actif,a.depth+1
    from ancestors a
    join public.profiles parent on parent.id=a.parent_profile_id
    where a.depth<3
  )
  select case
    when p_profile is null then false
    when p_scope='RESEAU' then
      exists (
        select 1 from public.profiles p
        where p.id=p_profile and p.role::text='promoteur' and p.actif
          and private.naxa_promoteur_valide(p.id)
      )
      and (
        p_pharmacie is null
        or exists (
          select 1 from public.promoteur_pharmacies pp
          join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true
          where pp.promoteur_id=p_profile and pp.pharmacie_id=p_pharmacie and pp.actif
        )
      )
    when p_scope='PHARMACIE' then
      p_pharmacie is not null
      and (
        exists (
          select 1 from public.profiles p
          join public.pharmacies ph on ph.id=p_pharmacie and ph.actif=true
          where p.id=p_profile and p.role::text='admin' and p.actif
        )
        or exists (
          select 1 from public.profiles p
          join public.promoteur_pharmacies pp
            on pp.promoteur_id=p.id and pp.pharmacie_id=p_pharmacie and pp.actif
          where p.id=p_profile and p.role::text='promoteur' and p.actif
            and private.naxa_promoteur_valide(p.id)
        )
        or (
          exists (
            select 1 from public.profiles actor
            where actor.id=p_profile and actor.actif
              and actor.pharmacie_id=p_pharmacie
              and actor.role::text in ('pharmacie','caisse')
          )
          and exists (
            select 1
            from ancestors a
            join public.promoteur_pharmacies pp
              on pp.promoteur_id=a.id and pp.pharmacie_id=p_pharmacie and pp.actif
            where a.role='promoteur' and a.actif
              and private.naxa_promoteur_valide(a.id)
          )
        )
      )
    when p_scope='POSTE_CAISSE' then
      p_pharmacie is not null
      and exists (
        select 1 from public.profiles actor
        where actor.id=p_profile and actor.role::text='caisse' and actor.actif
          and actor.pharmacie_id=p_pharmacie
      )
      and exists (
        select 1
        from ancestors a
        join public.promoteur_pharmacies pp
          on pp.promoteur_id=a.id and pp.pharmacie_id=p_pharmacie and pp.actif
        where a.role='promoteur' and a.actif
          and private.naxa_promoteur_valide(a.id)
      )
    else false
  end;
$scope$;

revoke all on function public.naxa_scope_allows(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.naxa_scope_allows(uuid,uuid,text) to authenticated;

-- The legacy lot-allocation migration can be replayed before or after this canonical
-- migration. Install its participant-read policy here when the table already exists.
do $reservation_policy$
begin
  if to_regclass('public.reservation_item_lots') is not null
     and not exists (
       select 1 from pg_catalog.pg_policies
       where schemaname='public'
         and tablename='reservation_item_lots'
         and policyname='reservation_item_lots_participant_read'
     ) then
    execute $create$
      create policy reservation_item_lots_participant_read
      on public.reservation_item_lots
      for select to authenticated
      using (
        exists (
          select 1
          from public.reservations r
          where r.id=reservation_item_lots.reservation_id
            and (
              r.client_id=(select auth.uid())
              or public.is_admin()
              or public.naxa_scope_allows((select auth.uid()),r.pharmacie_id,'PHARMACIE')
            )
        )
      )
    $create$;
  end if;
end;
$reservation_policy$;

create table if not exists public.reservation_item_lots (
  reservation_id uuid not null references public.reservations(id) on delete restrict,
  produit_id uuid not null references public.produits(id) on delete restrict,
  lot_id uuid not null references public.stocks_lots(id) on delete restrict,
  quantite integer not null check (quantite > 0),
  cree_le timestamptz not null default now(),
  restauree_at timestamptz,
  primary key (reservation_id, produit_id, lot_id)
);
create index if not exists reservation_item_lots_lot_idx on public.reservation_item_lots(lot_id);
alter table public.reservation_item_lots enable row level security;
drop policy if exists reservation_item_lots_participant_read on public.reservation_item_lots;
create policy reservation_item_lots_participant_read on public.reservation_item_lots
  for select to authenticated using (
    exists (
      select 1 from public.reservations r
      where r.id = reservation_id
        and (r.client_id = (select auth.uid()) or public.is_admin()
          or public.naxa_scope_allows((select auth.uid()), r.pharmacie_id, 'PHARMACIE'))
    )
  );
revoke all on public.reservation_item_lots from public, anon, authenticated;
grant select on public.reservation_item_lots to authenticated;

-- Preview bootstrap: the canonical notifications table lives in legacy migration_075,
-- outside the versioned migration directory replayed by Supabase Preview.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  pharmacie_id uuid references public.pharmacies(id) on delete cascade,
  type text not null,
  titre text not null check (char_length(titre) between 1 and 160),
  corps text not null check (char_length(corps) <= 1000),
  fil_id uuid,
  lu_le timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_un_destinataire
    check ((user_id is not null)::int + (pharmacie_id is not null)::int = 1)
);
alter table public.notifications add column if not exists fil_id uuid;

-- Preserve the canonical relationship when the messaging table is present in the target schema.
do $notifications_fil_fk$
begin
  if to_regclass('public.fils_messages') is not null
     and not exists (
       select 1
       from pg_catalog.pg_constraint
       where conrelid = 'public.notifications'::regclass
         and conname = 'notifications_fil_id_fkey'
     ) then
    alter table public.notifications
      add constraint notifications_fil_id_fkey
      foreign key (fil_id) references public.fils_messages(id) on delete cascade;
  end if;
end;
$notifications_fil_fk$;

alter table public.notifications enable row level security;
drop policy if exists notifications_read_recipient on public.notifications;
create policy notifications_read_recipient on public.notifications
  for select to authenticated using (
    user_id = (select auth.uid())
    or (pharmacie_id is not null and (
      public.is_admin()
      or public.naxa_scope_allows((select auth.uid()), pharmacie_id, 'PHARMACIE')
    ))
  );
revoke all on public.notifications from anon, public;
grant select on public.notifications to authenticated;
revoke insert, update, delete on public.notifications from anon, authenticated;

alter table public.notifications
  add column if not exists reservation_id uuid references public.reservations(id) on delete cascade;
create unique index if not exists notifications_reservation_expiry_once_uq
  on public.notifications(reservation_id, type)
  where reservation_id is not null and type = 'reservation_expiry_30m';

create or replace function public.expirer_reservations_cron(p_limit integer default 500)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
 v_row record; v_expired integer:=0; v_failed integer:=0; v_errors jsonb:='[]'::jsonb;
begin
 if p_limit is null or p_limit<1 or p_limit>5000 then raise exception 'Limite cron invalide'; end if;
 for v_row in
  select r.id
  from public.reservations r
  where r.mode='reservation' and r.statut in ('en_attente','confirmee') and r.expires_at<=now()
  order by r.expires_at,r.id
  limit p_limit
  for update skip locked
 loop
  begin
   -- Restitution lot/stock et statut sont dans la même transaction.
   perform public.restore_stock(v_row.id);
   update public.reservations set statut='expiree' where id=v_row.id and statut in ('en_attente','confirmee');
   if found then v_expired:=v_expired+1; end if;
  exception when others then
   -- Une incohérence sur un dossier ne doit pas annuler tout le lot cron.
   -- Le dossier reste actif et sera signalé/retry au prochain passage.
   v_failed:=v_failed+1;
   v_errors:=v_errors||jsonb_build_array(jsonb_build_object('reservation_id',v_row.id,'erreur',left(sqlerrm,300)));
  end;
 end loop;
 return jsonb_build_object('expirees',v_expired,'en_echec',v_failed,'erreurs',v_errors,'traite_le',now());
end;
$function$;
revoke all on function public.expirer_reservations_cron(integer) from public, anon, authenticated;
grant execute on function public.expirer_reservations_cron(integer) to service_role;
comment on function public.expirer_reservations_cron(integer) is
  'Expire les réservations échues, restitue lots et stock agrégé atomiquement, et signale les incohérences pour réconciliation.';

create or replace function public.notifier_reservations_expirant_30m()
returns integer language plpgsql security definer set search_path = ''
as $function$
declare v_count integer := 0;
begin
  with due as (
    select r.id, r.client_id, r.expires_at
    from public.reservations r
    where r.mode = 'reservation'
      and r.statut in ('en_attente', 'confirmee')
      and r.expires_at > now() + interval '25 minutes'
      and r.expires_at <= now() + interval '30 minutes'
      and not exists (
        select 1 from public.notifications n
        where n.user_id = r.client_id
          and n.type = 'reservation_expiry_30m'
          and n.corps like '%' || upper(left(replace(r.id::text, '-', ''), 8)) || '%'
      )
  ), inserted as (
    insert into public.notifications(user_id, type, titre, corps, reservation_id)
    select d.client_id, 'reservation_expiry_30m', 'Votre réservation expire dans 30 minutes',
      left('Réservation #' || upper(left(replace(d.id::text, '-', ''), 8))
        || ' : échéance prévue à ' || to_char(d.expires_at, 'DD/MM/YYYY HH24:MI TZH:TZM')
        || '. Contactez la pharmacie ou retirez vos articles avant cette heure.', 1000),
      d.id
    from due d
    on conflict (reservation_id,type) where reservation_id is not null and type='reservation_expiry_30m' do nothing
    returning id
  )
  select count(*)::integer into v_count from inserted;
  return v_count;
end;
$function$;
revoke all on function public.notifier_reservations_expirant_30m() from public, anon, authenticated;
grant execute on function public.notifier_reservations_expirant_30m() to service_role;
comment on function public.notifier_reservations_expirant_30m() is
  'Crée une seule notification par réservation dans la fenêtre de 25 à 30 minutes avant échéance.';

commit;
