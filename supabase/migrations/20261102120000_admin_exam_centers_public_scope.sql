-- Corrige la visibilité publique du catalogue Examens.
-- Le helper SECURITY DEFINER centralise les contrôles du partenaire, de l'univers et du feature flag.
-- Il évite la comparaison erronée pu.partner_id = pu.partner_id et les sous-requêtes RLS privées.

drop policy if exists exam_centers_public_read on public.exam_centers;

create policy exam_centers_public_read
on public.exam_centers
for select
to anon, authenticated
using (
  status = 'active'
  and public.universe_partner_is_public(exam_centers.partner_id, 'examens')
);

comment on policy exam_centers_public_read on public.exam_centers is
  'Centre actif visible uniquement si son partenaire actif est associé à l’univers Examens activé et que le feature flag est actif; vérification via helper SECURITY DEFINER dédié.';
