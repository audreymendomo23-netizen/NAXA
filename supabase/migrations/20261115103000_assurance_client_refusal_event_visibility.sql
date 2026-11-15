-- Allow the reservation-owning Client to read the event that records their refusal.
drop policy if exists assurance_evenements_scope_read on public.assurance_evenements;

create policy assurance_evenements_scope_read
on public.assurance_evenements
for select
to authenticated
using (
  public.can_access_pharmacy(pharmacie_id)
  or (
    type = any (array[
      'devis_calcule',
      'reservation_assurance_validee',
      'prise_en_charge_confirmee',
      'prise_en_charge_refusee',
      'montant_modifie',
      'accord_client_obtenu',
      'accord_client_refuse',
      'vente_assurance_enregistree',
      'remboursement_recu',
      'remboursement_partiel',
      'dossier_solde'
    ]::text[])
    and exists (
      select 1
      from public.reservations r
      where r.id=assurance_evenements.reservation_id
        and r.client_id=(select auth.uid())
    )
  )
);
