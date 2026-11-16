-- NAXA — confirmer le statut de réservation à l'acceptation Stock et inclure les frais de livraison dans le rapprochement POS.
BEGIN;
CREATE OR REPLACE FUNCTION private.set_reservation_status(p_id uuid, p_statut resa_statut)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r public.reservations;
  uid uuid := auth.uid();
  transition_ok boolean;
begin
  if uid is null then
    raise exception 'Connexion requise';
  end if;

  select * into r
  from public.reservations
  where id = p_id
  for update;

  if not found then
    raise exception 'Réservation introuvable';
  end if;

  if not (
    public.is_admin()
    or private.naxa_scope_allows(uid, r.pharmacie_id, 'PHARMACIE')
    or (r.client_id = uid and p_statut = 'annulee')
  ) then
    raise exception 'Action non autorisée';
  end if;

  transition_ok := case
    when r.statut = 'en_attente' then p_statut in ('confirmee', 'annulee', 'expiree')
    when r.statut = 'confirmee' then p_statut in ('annulee', 'expiree')
    when r.statut = 'payee' then p_statut = 'retiree'
    else false
  end;

  if p_statut = 'payee' then
    if not exists (
      select 1
      from public.ventes v
      where v.reservation_id = r.id
        and v.pharmacie_id = r.pharmacie_id
        and v.statut = 'payee'
        and v.total_net = r.total + CASE WHEN r.mode = 'commande' THEN COALESCE(r.frais_livraison, 0) ELSE 0 END
        and exists (
          select 1 from public.vente_paiements vp
          where vp.vente_id = v.id
        )
        and (
          select coalesce(sum(vp.montant), 0)
          from public.vente_paiements vp
          where vp.vente_id = v.id
        ) = v.total_net
    ) then
      raise exception 'Paiement refusé : le total des règlements POS ne correspond pas au montant brut de la réservation';
    end if;
    transition_ok := r.statut = 'confirmee';
  end if;

  if not transition_ok then
    raise exception 'Transition de réservation interdite: % -> %', r.statut, p_statut;
  end if;

  if p_statut in ('annulee', 'expiree') then
    perform public.restore_stock(p_id);
  end if;

  update public.reservations
  set statut = p_statut
  where id = p_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.gestionnaire_stock_confirmer_demande_livraison(p_reservation uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_role text;
  v_r public.reservations%rowtype;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;

  SELECT * INTO v_r
  FROM public.reservations
  WHERE id = p_reservation
  FOR UPDATE;

  IF NOT FOUND
    OR v_r.mode <> 'commande'
    OR v_r.commande_statut <> 'en_attente_pharmacie'
    OR v_r.statut IN ('annulee', 'expiree', 'retiree')
    OR v_r.livraison_demande_at IS NULL THEN
    RAISE EXCEPTION 'Cette demande de livraison ne peut plus être confirmée';
  END IF;

  IF NOT public.naxa_scope_allows(v_uid, v_r.pharmacie_id, 'PHARMACIE') THEN
    RAISE EXCEPTION 'Demande hors périmètre pharmacie';
  END IF;

  v_role := public.naxa_business_function(v_uid);
  IF NOT public.is_admin() AND v_role NOT IN ('gestionnaire_stock', 'magasinier') THEN
    RAISE EXCEPTION 'Seul le Gestionnaire de stock ou Magasinier peut confirmer la demande';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pharmacies ph
    WHERE ph.id = v_r.pharmacie_id
      AND ph.actif = true
      AND ph.archivee_le IS NULL
      AND ph.livraison_active = true
  ) THEN
    RAISE EXCEPTION 'Service de livraison indisponible';
  END IF;

  UPDATE public.reservations
  SET commande_statut = 'acceptee',
      livraison_confirmee_stock_at = COALESCE(livraison_confirmee_stock_at, now()),
      livraison_paiement_demande_at = COALESCE(livraison_paiement_demande_at, now()),
      expires_at = GREATEST(COALESCE(expires_at, now()), now() + interval '72 hours')
  WHERE id = p_reservation;

  IF v_r.statut = 'en_attente' THEN
    PERFORM public.set_reservation_status(p_reservation, 'confirmee'::public.resa_statut);
  END IF;

  INSERT INTO public.notifications(user_id, type, titre, corps, reservation_id, related_entity_id)
  VALUES (
    v_r.client_id,
    'delivery_payment_request',
    'Livraison acceptée · paiement demandé',
    'La pharmacie accepte votre demande. Choisissez votre mode de paiement pour poursuivre. Les Livreurs seront notifiés après la préparation physique et la vérification du paiement requis.',
    v_r.id,
    NULL
  );

  -- Ne pas appeler naxa_delivery_make_available ici : cette RPC impose preparation_statut='prete_au_retrait'.
  RETURN true;
END;
$function$
;
COMMIT;
