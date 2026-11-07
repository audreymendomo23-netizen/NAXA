begin;

create or replace function public.naxa_client_declarer_paiement_livraison(
  p_reservation uuid,
  p_reference text
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_r public.reservations%rowtype;
  v_reference text:=trim(coalesce(p_reference,''));
begin
  if v_uid is null then raise exception 'Connexion Client requise'; end if;
  if length(v_reference)<5 or length(v_reference)>120
    or v_reference !~ '^[[:alnum:][:space:]_./-]+$' then
    raise exception 'Référence de paiement invalide';
  end if;
  select * into v_r from public.reservations where id=p_reservation for update;
  if not found or v_r.client_id<>v_uid or v_r.mode<>'commande'
    or v_r.livraison_confirmee_stock_at is null
    or v_r.paiement_mode not in ('mtn_marchand','orange_money')
    or v_r.commande_statut not in ('acceptee','preparation','livreur_assigne')
    or v_r.paiement_statut='effectue' then
    raise exception 'La commande ne permet pas la déclaration de ce paiement';
  end if;
  if exists(select 1 from public.reservations r
    where r.pharmacie_id=v_r.pharmacie_id and r.paiement_ref=v_reference and r.id<>v_r.id) then
    raise exception 'Cette référence a déjà été utilisée dans cette pharmacie';
  end if;

  update public.reservations
  set paiement_ref=v_reference,
      paiement_statut='a_verifier'
  where id=p_reservation;

  insert into public.notifications(pharmacie_id,type,titre,corps,reservation_id)
  values(v_r.pharmacie_id,'delivery_payment_declared','Paiement de livraison à vérifier',
    'Le client a déclaré avoir payé. Vérifiez la référence dans le parcours de caisse ou sur le terminal Android avant de lancer la préparation.',
    v_r.id);
  return true;
end;
$function$;
revoke all on function public.naxa_client_declarer_paiement_livraison(uuid,text) from public,anon;
grant execute on function public.naxa_client_declarer_paiement_livraison(uuid,text) to authenticated;

commit;
