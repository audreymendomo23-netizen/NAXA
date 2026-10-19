-- NAXA 150 — lecture RLS des informations commerciales propres au Promoteur.
-- Le Promoteur consulte sa convention, son abonnement et ses paiements sans droit d’écriture.
alter table public.conventions_promoteurs enable row level security;
alter table public.abonnements_promoteurs enable row level security;
alter table public.abonnement_promoteur_paiements enable row level security;

drop policy if exists conventions_promoteur_own_read on public.conventions_promoteurs;
create policy conventions_promoteur_own_read
on public.conventions_promoteurs
for select to authenticated
using (promoteur_id=(select auth.uid()));

drop policy if exists abonnements_promoteur_own_read on public.abonnements_promoteurs;
create policy abonnements_promoteur_own_read
on public.abonnements_promoteurs
for select to authenticated
using (promoteur_id=(select auth.uid()));

drop policy if exists abonnement_promoteur_paiements_own_read on public.abonnement_promoteur_paiements;
create policy abonnement_promoteur_paiements_own_read
on public.abonnement_promoteur_paiements
for select to authenticated
using (
  exists (
    select 1 from public.abonnements_promoteurs ap
    where ap.id=abonnement_id and ap.promoteur_id=(select auth.uid())
  )
);
