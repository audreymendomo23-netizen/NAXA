-- NAXA — Audit 360 Admin : exiger un profil actif pour les politiques Admin du catalogue et du stock.
-- Cause racine : plusieurs politiques ALL accordaient les droits au seul rôle admin,
-- même si profiles.actif=false. Les gardes de pages/actions ne protègent pas les appels Data API directs.
-- public.is_admin() délègue à private.is_admin() et vérifie role='admin' ET actif=true.
-- Les politiques membres/partenaires distinctes restent intactes.

drop policy if exists feature_flag_test_accounts_admin_all on public.feature_flag_test_accounts;
create policy feature_flag_test_accounts_admin_all
on public.feature_flag_test_accounts
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists feature_flags_admin_all on public.feature_flags;
create policy feature_flags_admin_all
on public.feature_flags
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists partner_members_admin_all on public.partner_members;
create policy partner_members_admin_all
on public.partner_members
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists partner_universes_admin_all on public.partner_universes;
create policy partner_universes_admin_all
on public.partner_universes
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists partners_admin_all on public.partners;
create policy partners_admin_all
on public.partners
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists stock_movements_admin_all on public.stock_movements;
create policy stock_movements_admin_all
on public.stock_movements
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists suivi_professionals_admin_manage on public.suivi_professionals;
create policy suivi_professionals_admin_manage
on public.suivi_professionals
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

drop policy if exists universes_admin_all on public.universes;
create policy universes_admin_all
on public.universes
for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

-- Conserver sans changement la lecture des mouvements du membre partenaire.
-- Seule la branche Admin est alignée sur le garde canonique actif.
drop policy if exists stock_movements_partner_read on public.stock_movements;
create policy stock_movements_partner_read
on public.stock_movements
for select
to authenticated
using (
  (select public.is_admin())
  or exists (
    select 1
    from public.partner_members pm
    join public.partners pa
      on pa.id = pm.partner_id
     and pa.status = 'active'
    where pm.partner_id = stock_movements.partner_id
      and pm.user_id = (select auth.uid())
  )
);
