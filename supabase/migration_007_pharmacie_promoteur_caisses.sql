-- NAXA — organisation pharmacie : Promoteur parent / Caisses enfants
-- Additif non destructif : une pharmacie reste une seule entité et un seul stock.

alter type public.role_type add value if not exists 'promoteur';
alter type public.role_type add value if not exists 'caisse';

alter table public.profiles
  add column if not exists parent_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists actif boolean not null default true;

create index if not exists profiles_parent_profile_idx on public.profiles(parent_profile_id);
create index if not exists profiles_pharmacie_role_idx on public.profiles(pharmacie_id,role);

create or replace function public.is_promoteur()
returns boolean language sql stable security definer set search_path=public
as $$select exists(
  select 1 from public.profiles
  where id=auth.uid() and role='promoteur' and actif=true and pharmacie_id is not null
)$$;

create or replace function public.my_pharmacie()
returns uuid language sql stable security definer set search_path=public
as $$select pharmacie_id from public.profiles
where id=auth.uid() and actif=true and role in ('pharmacie','promoteur','caisse')$$;

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select using(
  id=auth.uid() or is_admin() or parent_profile_id=auth.uid()
);

drop policy if exists profiles_admin on public.profiles;
create policy profiles_admin on public.profiles for all using(is_admin()) with check(is_admin());

drop policy if exists profiles_promoteur_children on public.profiles;
create policy profiles_promoteur_children on public.profiles for select using(
  parent_profile_id=auth.uid() and is_promoteur()
);

create policy profiles_promoteur_update_children on public.profiles
for update using(parent_profile_id=auth.uid() and is_promoteur())
with check(
  parent_profile_id=auth.uid()
  and role='caisse'
  and pharmacie_id=(select pharmacie_id from public.profiles where id=auth.uid())
);

drop policy if exists stocks_write on public.stocks;
create policy stocks_write on public.stocks for all using(
  pharmacie_id=my_pharmacie() or is_admin()
) with check(
  pharmacie_id=my_pharmacie() or is_admin()
);

create or replace function public.set_garde(p_garde boolean)
returns void language plpgsql security definer set search_path=public
as $$begin
  if my_pharmacie() is null then raise exception 'Réservé aux comptes pharmacie actifs'; end if;
  update public.pharmacies set de_garde=p_garde where id=my_pharmacie();
end$$;
