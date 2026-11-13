begin;

create or replace function public.naxa_delivery_pending_payment_list_v2(p_pharmacie uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_result jsonb;
begin
  if v_uid is null or not public.naxa_caisse_actor_for_pharmacy(p_pharmacie) then
    raise exception 'La liste des paiements est réservée à la Caisse active de cette pharmacie';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'reservation_id',r.id,
    'mission_id',m.id,
    'reference_code',r.code_paiement,
    'client_id',r.client_id,
    'client_phone',r.telephone_livraison,
    'mode',r.paiement_mode,
    'reference',coalesce(pr.reference,r.paiement_ref),
    'expected_amount',r.total+r.frais_livraison,
    'declared_amount',pr.declared_amount,
    'payer_number',pr.payer_number,
    'payment_occurred_at',pr.payment_occurred_at,
    'proof_source',pr.proof_source,
    'field_sources',pr.field_sources,
    'sms_match_status',coalesce(pr.sms_match_status,'not_checked'),
    'sms_matched_at',pr.sms_matched_at,
    'financial_confirmation_status',pc.confirmation_status,
    'naxa_receipt_number',pc.receipt_number,
    'financially_confirmed_at',pc.confirmed_at,
    'merchant_sms_received_at',pc.merchant_received_at,
    'merchant_sms_occurred_at',pc.merchant_occurred_at,
    'cash_received',pr.cash_received,
    'cash_change',pr.cash_change,
    'payment_status',coalesce(pr.status,'declared'),
    'created_at',r.livraison_paiement_demande_at,
    'livreur_id',m.livreur_id
  ) order by r.livraison_paiement_demande_at),'[]'::jsonb)
  into v_result
  from public.reservations r
  left join public.naxa_delivery_missions m on m.reservation_id=r.id
  left join public.naxa_delivery_payment_records pr on pr.reservation_id=r.id
  left join public.naxa_delivery_payment_confirmations pc on pc.payment_record_id=pr.id
  where r.pharmacie_id=p_pharmacie and r.mode='commande'
    and r.livraison_confirmee_stock_at is not null
    and r.paiement_statut<>'effectue'
    and r.commande_statut in ('acceptee','preparation','livreur_assigne','en_livraison')
    and (
      (r.paiement_mode in ('mtn_marchand','orange_money') and pr.status='declared')
      or (r.paiement_mode='especes_livraison' and pr.status='cash_declared')
    );

  return v_result;
end;
$function$;

revoke all on function public.naxa_delivery_pending_payment_list_v2(uuid) from public,anon;
grant execute on function public.naxa_delivery_pending_payment_list_v2(uuid) to authenticated;

commit;
