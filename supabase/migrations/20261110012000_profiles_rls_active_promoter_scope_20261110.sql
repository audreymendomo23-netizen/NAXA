-- Restrict profile team access to the active, commercially valid Promoteur.
-- The legacy profiles_self parent clause bypassed the canonical role router.
begin;

drop policy if exists profiles_self on public.profiles;
create policy profiles_self
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (select public.is_admin())
);

drop policy if exists profiles_promoteur_children on public.profiles;
create policy profiles_promoteur_children
on public.profiles
for select
to authenticated
using (
  parent_profile_id = (select auth.uid())
  and (select public.naxa_business_function((select auth.uid()))) = 'promoteur'
);

drop policy if exists profiles_promoteur_update_children on public.profiles;
create policy profiles_promoteur_update_children
on public.profiles
for update
to authenticated
using (
  parent_profile_id = (select auth.uid())
  and (select public.naxa_business_function((select auth.uid()))) = 'promoteur'
)
with check (
  parent_profile_id = (select auth.uid())
  and role = 'caisse'
  and pharmacie_id = (select public.my_pharmacie())
  and (select public.naxa_business_function((select auth.uid()))) = 'promoteur'
);

-- Authenticated users only; no anonymous profile access.
drop policy if exists profiles_admin on public.profiles;
create policy profiles_admin
on public.profiles
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

commit;
