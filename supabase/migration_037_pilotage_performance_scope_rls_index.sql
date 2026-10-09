-- NAXA 037 — optimisation du scope Promoteur introduit par 035
create index if not exists promoteur_pharmacies_pharmacie_idx
on public.promoteur_pharmacies(pharmacie_id);

drop policy if exists promoteur_pharmacies_admin on public.promoteur_pharmacies;
drop policy if exists promoteur_pharmacies_self on public.promoteur_pharmacies;

create policy promoteur_pharmacies_select on public.promoteur_pharmacies
for select using (promoteur_id=(select auth.uid()) or public.is_admin());

create policy promoteur_pharmacies_insert on public.promoteur_pharmacies
for insert with check (public.is_admin());

create policy promoteur_pharmacies_update on public.promoteur_pharmacies
for update using (public.is_admin()) with check (public.is_admin());

create policy promoteur_pharmacies_delete on public.promoteur_pharmacies
for delete using (public.is_admin());

revoke all on public.promoteur_pharmacies from anon;
grant select on public.promoteur_pharmacies to authenticated;
grant insert,update,delete on public.promoteur_pharmacies to authenticated;