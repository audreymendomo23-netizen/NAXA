-- NAXA ERP-003 — lecture des dossiers par le Pharmacien sans droit d'édition direct.
begin;

drop policy if exists prescriptions_staff_read on public.prescriptions;
create policy prescriptions_staff_read
on public.prescriptions for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid())
      and p.actif
      and p.pharmacie_id=prescriptions.pharmacie_id
      and p.fonction_interne in ('pharmacien','pharmacien_assistant')
  )
  or exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid())
      and p.actif
      and p.role::text='promoteur'
      and p.pharmacie_id=prescriptions.pharmacie_id
  )
);

-- Les deux fonctions peuvent lire les lignes d'ordonnance dans leur pharmacie.
-- L'écriture reste réservée au circuit historique assistant/promoteur.
drop policy if exists prescription_items_staff on public.prescription_items;
drop policy if exists prescription_items_staff_read on public.prescription_items;
create policy prescription_items_staff_read
on public.prescription_items for select to authenticated
using (
  exists (
    select 1 from public.prescriptions r
    join public.profiles p on p.pharmacie_id=r.pharmacie_id
    where r.id=prescription_items.prescription_id
      and p.id=(select auth.uid())
      and p.actif
      and p.fonction_interne in ('pharmacien','pharmacien_assistant')
  )
  or exists (
    select 1 from public.prescriptions r
    join public.profiles p on p.pharmacie_id=r.pharmacie_id
    where r.id=prescription_items.prescription_id
      and p.id=(select auth.uid())
      and p.actif
      and p.role::text='promoteur'
  )
);

create policy prescription_items_assistant_write
on public.prescription_items for all to authenticated
using (
  exists (
    select 1 from public.prescriptions r
    join public.profiles p on p.pharmacie_id=r.pharmacie_id
    where r.id=prescription_items.prescription_id
      and p.id=(select auth.uid())
      and p.actif
      and (p.role::text='promoteur' or p.fonction_interne='pharmacien_assistant')
  )
)
with check (
  exists (
    select 1 from public.prescriptions r
    join public.profiles p on p.pharmacie_id=r.pharmacie_id
    where r.id=prescription_items.prescription_id
      and p.id=(select auth.uid())
      and p.actif
      and (p.role::text='promoteur' or p.fonction_interne='pharmacien_assistant')
  )
);

commit;
