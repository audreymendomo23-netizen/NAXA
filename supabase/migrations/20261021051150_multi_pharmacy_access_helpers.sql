-- NAXA — restore the multi-pharmacy authorization dependency before RPC revocation.
-- The historical root migration 012a defined this contract, but Preview only replays
-- supabase/migrations. Keep the original multi-pharmacy semantics.
begin;

alter type public.role_type add value if not exists 'promoteur';
alter type public.role_type add value if not exists 'caisse';

alter table public.profiles
  add column if not exists parent_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists actif boolean not null default true;

create index if not exists profiles_parent_profile_idx on public.profiles(parent_profile_id);

create table if not exists public.promoteur_pharmacies (
  promoteur_id uuid not null references public.profiles(id) on delete cascade,
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (promoteur_id, pharmacie_id)
);
create index if not exists promoteur_pharmacies_pharmacie_idx on public.promoteur_pharmacies(pharmacie_id);
alter table public.promoteur_pharmacies enable row level security;
drop policy if exists promoteur_pharmacies_admin on public.promoteur_pharmacies;
create policy promoteur_pharmacies_admin on public.promoteur_pharmacies
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
drop policy if exists promoteur_pharmacies_owner on public.promoteur_pharmacies;
create policy promoteur_pharmacies_owner on public.promoteur_pharmacies
  for select to authenticated
  using (promoteur_id = (select auth.uid()));
revoke all on public.promoteur_pharmacies from public, anon, authenticated;
grant select, insert, update, delete on public.promoteur_pharmacies to authenticated;

create or replace function public.is_promoteur()
returns boolean
language sql stable security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role::text = 'promoteur' and p.actif is true
  );
$function$;

create or replace function public.my_pharmacies()
returns setof uuid
language sql stable security definer
set search_path = ''
as $function$
  select p.id
  from public.pharmacies p
  where (select public.is_admin())
  union
  select pp.pharmacie_id
  from public.promoteur_pharmacies pp
  where pp.promoteur_id = (select auth.uid())
    and pp.actif is true
    and (select public.is_promoteur())
  union
  select p.pharmacie_id
  from public.profiles p
  where p.id = (select auth.uid())
    and p.actif is true
    and p.pharmacie_id is not null;
$function$;

create or replace function public.can_access_pharmacy(p_pharmacie uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $function$
  select coalesce(
    p_pharmacie is not null
    and exists (select 1 from public.my_pharmacies() x where x = p_pharmacie),
    false
  );
$function$;

revoke all on function public.is_promoteur() from public, anon;
revoke all on function public.my_pharmacies() from public, anon;
revoke all on function public.can_access_pharmacy(uuid) from public, anon;
grant execute on function public.is_promoteur() to authenticated;
grant execute on function public.my_pharmacies() to authenticated;
grant execute on function public.can_access_pharmacy(uuid) to authenticated;

comment on function public.can_access_pharmacy(uuid) is
  'Vérifie l''appartenance à une pharmacie du profil courant, en tenant compte du périmètre multi-pharmacie explicite.';

commit;
