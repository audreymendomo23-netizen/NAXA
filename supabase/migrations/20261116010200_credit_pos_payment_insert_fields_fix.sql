-- Correct POS credit finalization without widening the payment-row mutation guard.
-- Credit amount fields are written atomically on INSERT; finalization verifies them.

begin;

create or replace function public.vente_ajouter_paiement(
  p_vente uuid,
  p_mode public.mode_paiement_caisse,
  p_montant integer,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_vente public.ventes%rowtype;
  v_id uuid;
  v_deja integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_montant is null or p_montant<=0 then raise exception 'Montant de paiement invalide'; end if;
  if p_mode in ('orange_money','mtn_momo','mobile_money') then
    raise exception 'Paiement électronique indisponible : aucune confirmation opérateur officielle n’est intégrée';
  end if;
  if p_mode='especes' then
    raise exception 'Le paiement espèces ne peut pas être fractionné ; utilisez vente_encaisser_finaliser';
  end if;

  select * into v_vente from public.ventes where id=p_vente for update;
  if not found or v_vente.statut<>'brouillon' then raise exception 'Vente introuvable ou déjà clôturée'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then raise exception 'Vente hors périmètre'; end if;
  select coalesce(sum(montant),0) into v_deja from public.vente_paiements where vente_id=p_vente;
  if v_deja+p_montant>v_vente.total_net then raise exception 'Le paiement dépasse le total de la vente'; end if;

  insert into public.vente_paiements(
    vente_id,mode,montant,reference,created_by,montant_percu,monnaie_rendue
  )
  values(
    p_vente,p_mode,p_montant,nullif(trim(p_reference),''),auth.uid(),
    case when p_mode='credit' then p_montant else null end,
    0
  )
  returning id into v_id;
  return v_id;
end
$function$;

create or replace function public.vente_credit_finaliser(
  p_vente uuid,
  p_reference text default null
)
returns table(
  resultat text,
  demande_id uuid,
  operation_id uuid,
  numero_vente text,
  total integer
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_vente public.ventes%rowtype;
  v_credit public.client_credits%rowtype;
  v_request public.client_credit_requests%rowtype;
  v_request_id uuid;
  v_operation_id uuid;
  v_balance bigint;
  v_session public.caisses_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_vente is null then raise exception 'Vente requise'; end if;
  select * into v_vente from public.ventes where id=p_vente for update;
  if not found or v_vente.statut<>'brouillon' then
    raise exception 'Vente introuvable ou déjà finalisée';
  end if;
  if v_vente.client_id is null then raise exception 'Associez un Client à cette vente avant de choisir le crédit'; end if;
  if v_vente.total_net<=0 or not exists(select 1 from public.vente_lignes vl where vl.vente_id=p_vente) then
    raise exception 'Vente vide ou montant invalide';
  end if;
  if not (public.is_admin() or public.naxa_caisse_actor_for_pharmacy(v_vente.pharmacie_id)) then
    raise exception 'Finalisation à crédit réservée à une Caisse autorisée de cette pharmacie';
  end if;
  if not exists (
    select 1 from public.pharmacies ph
    where ph.id=v_vente.pharmacie_id and ph.actif and ph.archivee_le is null
  ) then raise exception 'La pharmacie est inactive ou archivée'; end if;

  select cs.* into v_session
  from public.caisses_sessions cs
  join public.caisses c on c.id=cs.caisse_id
  where cs.id=v_vente.caisse_session_id and cs.statut='ouverte' and cs.cloture_at is null
    and c.actif and c.pharmacie_id=v_vente.pharmacie_id
    and (public.is_admin() or cs.ouvert_par=auth.uid())
  for update of cs;
  if not found then raise exception 'Session personnelle de caisse ouverte requise'; end if;
  if not exists(select 1 from public.vente_lignes vl where vl.vente_id=p_vente) then
    raise exception 'Vente vide';
  end if;
  if exists(select 1 from public.vente_paiements vp where vp.vente_id=p_vente) then
    raise exception 'Un paiement existe déjà pour cette vente';
  end if;

  select * into v_credit from public.client_credits c
  where c.client_id=v_vente.client_id and c.pharmacie_id=v_vente.pharmacie_id and c.actif
  for update;
  if not found then raise exception 'Aucun compte de crédit actif pour ce Client dans cette pharmacie'; end if;

  select * into v_request from public.client_credit_requests q
  where q.vente_id=p_vente
  order by q.created_at desc,q.id desc limit 1
  for update;

  if found then
    if v_request.statut='en_attente' then
      return query select 'decision_requise',v_request.id,null::uuid,v_vente.numero_vente,v_vente.total_net;
      return;
    end if;
    if v_request.statut='rejetee' then
      raise exception 'La demande de crédit de cette vente a été refusée ; le Client doit régler comptant ou une nouvelle vente doit être créée';
    end if;
    if v_request.statut<>'approuvee' or v_request.consumed_at is not null then
      raise exception 'La demande de crédit est déjà consommée ou dans un état non autorisé';
    end if;
    if v_request.montant<>v_vente.total_net then
      raise exception 'Le panier a changé depuis l’approbation ; le montant doit être réexaminé';
    end if;
  else
    if exists (
      select 1 from public.client_credit_requests q
      where q.client_id=v_vente.client_id and q.statut in ('en_attente','approuvee')
        and q.consumed_at is null
    ) then
      raise exception 'Une autre demande de crédit de ce Client est déjà en cours';
    end if;
    v_balance:=v_credit.solde::bigint+v_vente.total_net::bigint;
    if v_balance>v_credit.plafond then
      v_request_id:=public.client_credit_demander(p_vente,v_vente.total_net,'Achat à crédit au comptoir');
      return query select 'decision_requise',v_request_id,null::uuid,v_vente.numero_vente,v_vente.total_net;
      return;
    end if;
  end if;

  v_operation_id:=public.client_credit_enregistrer_vente(
    p_vente,v_vente.total_net,nullif(trim(p_reference),'')
  );
  if v_operation_id is null then raise exception 'Opération de crédit non créée'; end if;

  update public.client_credit_operations op
  set caisse_session_id=v_vente.caisse_session_id
  where op.id=v_operation_id and op.vente_id=p_vente and op.nature='credit';
  if not found then raise exception 'Opération de crédit non rattachée à la session de caisse'; end if;

  -- vente_ajouter_paiement inserts the exact credit amount/receipt fields.
  -- The POS payment guard intentionally rejects UPDATE; do not bypass it.
  if not exists (
    select 1 from public.vente_paiements vp
    where vp.vente_id=p_vente and vp.mode='credit'
      and vp.montant=v_vente.total_net
      and vp.montant_percu=v_vente.total_net
      and vp.monnaie_rendue=0
  ) then
    raise exception 'Paiement POS crédit absent ou incomplet';
  end if;

  update public.ventes v
  set statut='payee',mode_paiement='credit',paiement_ref=nullif(trim(p_reference),''),paid_at=now()
  where v.id=p_vente and v.statut='brouillon';
  if not found then raise exception 'La vente à crédit n’a pas pu être finalisée'; end if;

  return query select 'finalisee',v_request.id,v_operation_id,v_vente.numero_vente,v_vente.total_net;
end
$function$;

revoke all on function public.vente_ajouter_paiement(uuid,public.mode_paiement_caisse,integer,text) from public,anon;
grant execute on function public.vente_ajouter_paiement(uuid,public.mode_paiement_caisse,integer,text) to authenticated,service_role;

revoke all on function public.vente_credit_finaliser(uuid,text) from public,anon;
grant execute on function public.vente_credit_finaliser(uuid,text) to authenticated,service_role;

commit;
