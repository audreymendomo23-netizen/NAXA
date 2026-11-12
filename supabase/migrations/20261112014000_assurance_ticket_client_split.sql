-- Le ticket client expose les deux composantes financières Assurance sans confondre créance et encaissement.
create or replace function public.get_client_reservation_ticket(p_reservation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_res public.reservations%rowtype;
  v_sale public.ventes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;

  select r.* into v_res
  from public.reservations r
  where r.id = p_reservation_id
    and r.client_id = auth.uid()
    and r.statut::text in ('payee', 'retiree');

  if not found then
    raise exception 'Ticket indisponible pour cette réservation';
  end if;

  select v.* into v_sale
  from public.ventes v
  where v.reservation_id = v_res.id
    and v.statut::text = 'payee'
  order by v.paid_at desc nulls last, v.created_at desc
  limit 1;

  if not found then
    raise exception 'Aucune vente POS payée associée à cette réservation';
  end if;

  return jsonb_build_object(
    'receipt_type', 'cashier_ticket',
    'sale', jsonb_build_object(
      'vente_id', v_sale.id,
      'numero_vente', v_sale.numero_vente,
      'pharmacie_id', v_sale.pharmacie_id,
      'statut', v_sale.statut::text,
      'created_at', v_sale.created_at,
      'paid_at', v_sale.paid_at,
      'total_brut', v_sale.total_brut,
      'remise', v_sale.remise,
      'total_net', v_sale.total_net,
      'mode_paiement', v_sale.mode_paiement::text,
      'paiement_ref', v_sale.paiement_ref
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'produit_id', vl.produit_id,
        'produit_nom', p.nom,
        'produit_dosage', p.dosage,
        'quantite', vl.quantite,
        'prix_unitaire', vl.prix_unitaire,
        'total_ligne', vl.total_ligne
      ) order by vl.id)
      from public.vente_lignes vl
      join public.produits p on p.id = vl.produit_id
      where vl.vente_id = v_sale.id
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'mode', vp.mode::text,
        'montant', vp.montant,
        'reference', vp.reference,
        'montant_percu', vp.montant_percu,
        'monnaie_rendue', vp.monnaie_rendue,
        'created_at', vp.created_at
      ) order by vp.created_at, vp.id)
      from public.vente_paiements vp
      where vp.vente_id = v_sale.id
    ), '[]'::jsonb),
    'assurance', (
      select jsonb_build_object(
        'assureur_nom', a.nom,
        'montant_brut_fcfa', s.montant_brut_fcfa,
        'montant_assureur_fcfa', s.montant_assureur_fcfa,
        'montant_client_fcfa', s.montant_client_fcfa,
        'valide_client', s.valide_client,
        'controle_documents_statut', s.controle_documents_statut,
        'statut_dossier', d.statut,
        'montant_rembourse_fcfa', coalesce(d.montant_rembourse, 0),
        'statut_remboursement', coalesce(d.statut_remboursement, 'non_rembourse')
      )
      from public.assurance_reservation_snapshots s
      join public.dossiers_assurance d
        on d.reservation_id = s.reservation_id
       and d.pharmacie_id = s.pharmacie_id
      left join public.assureurs a on a.id = s.assureur_id
      where s.reservation_id = v_res.id
      limit 1
    ),
    'reservation', jsonb_build_object(
      'reservation_id', v_res.id,
      'ticket_numero_snapshot', v_res.paiement_ticket_numero,
      'montant_percu_snapshot', v_res.paiement_montant_percu,
      'monnaie_rendue_snapshot', v_res.paiement_monnaie_rendue,
      'paiement_valide_at', v_res.paiement_valide_at
    )
  );
end;
$function$;

revoke all on function public.get_client_reservation_ticket(uuid) from public, anon;
grant execute on function public.get_client_reservation_ticket(uuid) to authenticated;
