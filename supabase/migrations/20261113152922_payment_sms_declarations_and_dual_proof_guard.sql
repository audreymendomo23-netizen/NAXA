begin;

alter table public.naxa_delivery_payment_records
  add column if not exists payer_number text,
  add column if not exists declared_amount integer,
  add column if not exists payment_occurred_at timestamptz,
  add column if not exists proof_source text not null default 'manual_entry',
  add column if not exists field_sources jsonb not null default '{}'::jsonb,
  add column if not exists sms_payload_sha256 text;

alter table public.naxa_delivery_payment_records
  drop constraint if exists naxa_delivery_payment_records_proof_source_ck;
alter table public.naxa_delivery_payment_records
  add constraint naxa_delivery_payment_records_proof_source_ck
  check (proof_source in ('shared_sms','manual_entry'));

alter table public.naxa_delivery_payment_records
  drop constraint if exists naxa_delivery_payment_records_declared_amount_ck;
alter table public.naxa_delivery_payment_records
  add constraint naxa_delivery_payment_records_declared_amount_ck
  check (declared_amount is null or declared_amount > 0);

alter table public.naxa_delivery_payment_records
  drop constraint if exists naxa_delivery_payment_records_sms_hash_ck;
alter table public.naxa_delivery_payment_records
  add constraint naxa_delivery_payment_records_sms_hash_ck
  check (sms_payload_sha256 is null or sms_payload_sha256 ~ '^[0-9a-f]{64}$');

create or replace function public.naxa_client_declarer_paiement_livraison_v2(
  p_reservation uuid,
  p_client uuid,
  p_reference text,
  p_payer_number text,
  p_declared_amount integer,
  p_payment_occurred_at timestamptz,
  p_proof_source text,
  p_field_sources jsonb default '{}'::jsonb,
  p_sms_payload_sha256 text default null
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_r public.reservations%rowtype;
  v_reference text:=trim(coalesce(p_reference,''));
  v_now timestamptz:=now();
begin
  if auth.role()<>'service_role' then raise exception 'Service NAXA requis'; end if;
  if p_client is null or p_reservation is null then raise exception 'Client et commande requis'; end if;
  if length(v_reference)<5 or length(v_reference)>120
    or v_reference !~ '^[[:alnum:][:space:]_./-]+$' then
    raise exception 'Référence de paiement invalide';
  end if;
  if p_declared_amount is null or p_declared_amount<=0 then raise exception 'Montant déclaré invalide'; end if;
  if p_proof_source not in ('shared_sms','manual_entry') then raise exception 'Provenance de preuve invalide'; end if;
  if p_payment_occurred_at is null or p_payment_occurred_at>v_now+interval '5 minutes'
     or p_payment_occurred_at<v_now-interval '7 days' then
    raise exception 'Date de paiement hors de la fenêtre autorisée';
  end if;
  if p_payer_number is not null and (
    length(regexp_replace(p_payer_number,'[^0-9]','','g'))<8
    or length(regexp_replace(p_payer_number,'[^0-9]','','g'))>15
  ) then raise exception 'Numéro payeur invalide'; end if;
  if p_sms_payload_sha256 is not null and p_sms_payload_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Empreinte SMS invalide';
  end if;

  select * into v_r from public.reservations where id=p_reservation for update;
  if not found or v_r.client_id<>p_client or v_r.mode<>'commande'
    or v_r.livraison_confirmee_stock_at is null
    or v_r.paiement_mode not in ('mtn_marchand','orange_money')
    or v_r.commande_statut not in ('acceptee','preparation','livreur_assigne','en_livraison')
    or v_r.paiement_statut='effectue' then
    raise exception 'La commande ne permet pas cette déclaration de paiement';
  end if;
  if exists(select 1 from public.reservations r
    where r.pharmacie_id=v_r.pharmacie_id and r.paiement_ref=v_reference and r.id<>v_r.id) then
    raise exception 'Cette référence a déjà été utilisée dans cette pharmacie';
  end if;

  update public.reservations
    set paiement_ref=v_reference,paiement_statut='a_verifier'
    where id=v_r.id;

  insert into public.naxa_delivery_payment_records(
    reservation_id,pharmacie_id,client_id,mode,expected_amount,reference,
    payer_number,declared_amount,payment_occurred_at,proof_source,field_sources,
    sms_payload_sha256,status,declared_by,declared_at
  ) values (
    v_r.id,v_r.pharmacie_id,p_client,v_r.paiement_mode,
    v_r.total+v_r.frais_livraison,v_reference,
    nullif(trim(coalesce(p_payer_number,'')),''),p_declared_amount,p_payment_occurred_at,
    p_proof_source,case when jsonb_typeof(coalesce(p_field_sources,'{}'::jsonb))='object'
      then coalesce(p_field_sources,'{}'::jsonb) else '{}'::jsonb end,
    p_sms_payload_sha256,'declared',p_client,v_now
  )
  on conflict(reservation_id) do update
    set mode=excluded.mode,expected_amount=excluded.expected_amount,reference=excluded.reference,
        payer_number=excluded.payer_number,declared_amount=excluded.declared_amount,
        payment_occurred_at=excluded.payment_occurred_at,proof_source=excluded.proof_source,
        field_sources=excluded.field_sources,sms_payload_sha256=excluded.sms_payload_sha256,
        status='declared',declared_by=p_client,declared_at=v_now,
        cash_received=null,cash_change=0,validated_by=null,validated_at=null,
        caisse_session_id=null,vente_id=null,rejection_reason=null,updated_at=v_now
    where public.naxa_delivery_payment_records.status<>'paid';

  if not found then raise exception 'Un paiement a déjà été validé pour cette commande'; end if;
  insert into public.notifications(pharmacie_id,type,titre,corps,reservation_id)
  values(v_r.pharmacie_id,'delivery_payment_declared','Paiement de livraison à vérifier',
    'Le client a transmis une déclaration de paiement. Vérifiez le crédit réellement reçu dans votre compte marchand avant validation.',
    v_r.id);
  return true;
end;
$function$;
revoke all on function public.naxa_client_declarer_paiement_livraison_v2(uuid,uuid,text,text,integer,timestamptz,text,jsonb,text)
  from public,anon,authenticated;
grant execute on function public.naxa_client_declarer_paiement_livraison_v2(uuid,uuid,text,text,integer,timestamptz,text,jsonb,text)
  to service_role;

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
