-- NAXA — la confirmation de demande par Stock ne publie pas encore une mission.
-- La mission n'est créée qu'après la préparation physique "prete_au_retrait".
BEGIN;

CREATE OR REPLACE FUNCTION public.gestionnaire_stock_confirmer_demande_livraison(p_reservation uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
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
$function$;

REVOKE ALL ON FUNCTION public.gestionnaire_stock_confirmer_demande_livraison(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gestionnaire_stock_confirmer_demande_livraison(uuid) TO authenticated;

COMMIT;
