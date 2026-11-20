CREATE OR REPLACE FUNCTION public.transition_universe_reservation(
  p_reservation_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  uid uuid := auth.uid();
  r public.universe_reservations%rowtype;
  it record;
  is_admin boolean;
  can_manage boolean;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Connexion requise';
  END IF;

  -- Le statut global du profil prévaut sur les rôles et anciennes affectations.
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = uid
      AND p.actif IS TRUE
  ) THEN
    RAISE EXCEPTION 'Profil inactif ou suspendu';
  END IF;

  SELECT *
  INTO r
  FROM public.universe_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation introuvable';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = uid
      AND p.role = 'admin'
      AND p.actif IS TRUE
  ) INTO is_admin;

  SELECT EXISTS (
    SELECT 1
    FROM public.partner_members pm
    JOIN public.partners pa ON pa.id = pm.partner_id
    WHERE pm.partner_id = r.partner_id
      AND pm.user_id = uid
      AND pm.member_role IN ('owner', 'manager', 'operator')
      AND pa.status = 'active'
  ) INTO can_manage;

  IF r.universe_slug = 'bebe-maman' AND is_admin THEN
    RAISE EXCEPTION 'La supervision Admin Bébé & Maman est en lecture seule';
  END IF;

  IF p_status = 'cancelled'
     AND r.client_id = uid
     AND r.status IN ('requested', 'confirmed') THEN
    IF r.payment_mode IN ('orange_money', 'mtn_momo') THEN
      IF r.payment_status <> 'awaiting_payment' THEN
        RAISE EXCEPTION 'Le SMS payeur a déjà été soumis ou le paiement est rapproché ; annulation directe refusée. Contactez le partenaire pour traiter le dossier.';
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.naxa_universe_payment_intents i
        WHERE i.reservation_id = r.id
          AND i.status IN ('submitted', 'matched')
      ) THEN
        RAISE EXCEPTION 'Un SMS payeur a déjà été soumis ; annulation directe refusée.';
      END IF;

      UPDATE public.naxa_universe_payment_intents
      SET status = 'cancelled', updated_at = now()
      WHERE reservation_id = r.id
        AND status = 'active';

      UPDATE public.universe_reservations
      SET status = 'cancelled',
          payment_mode = NULL,
          payment_status = 'not_required',
          updated_at = now()
      WHERE id = r.id;
    ELSE
      UPDATE public.universe_reservations
      SET status = 'cancelled', updated_at = now()
      WHERE id = r.id;
    END IF;
    RETURN;
  END IF;

  IF NOT (is_admin OR can_manage) THEN
    RAISE EXCEPTION 'Action non autorisée';
  END IF;

  IF r.status IN ('picked_up', 'cancelled', 'expired') THEN
    RAISE EXCEPTION 'Réservation déjà clôturée';
  END IF;

  IF p_status = 'confirmed' AND r.status = 'requested' THEN
    UPDATE public.universe_reservations
    SET status = 'confirmed', updated_at = now()
    WHERE id = r.id;
  ELSIF p_status = 'ready' AND r.status IN ('requested', 'confirmed') THEN
    UPDATE public.universe_reservations
    SET status = 'ready', updated_at = now()
    WHERE id = r.id;
  ELSIF p_status = 'picked_up' AND r.status = 'ready' THEN
    IF r.payment_mode IN ('orange_money', 'mtn_momo')
       AND r.payment_status <> 'confirmed' THEN
      RAISE EXCEPTION 'Le paiement électronique doit être rapproché par les deux SMS avant le retrait';
    END IF;

    FOR it IN
      SELECT ri.product_id, ri.quantity, pp.stock_quantity
      FROM public.universe_reservation_items ri
      JOIN public.partner_products pp ON pp.id = ri.product_id
      WHERE ri.reservation_id = r.id
      ORDER BY ri.product_id
      FOR UPDATE OF pp
    LOOP
      IF it.stock_quantity < it.quantity THEN
        RAISE EXCEPTION 'Stock physique insuffisant lors du retrait';
      END IF;

      UPDATE public.partner_products
      SET stock_quantity = stock_quantity - it.quantity,
          updated_at = now()
      WHERE id = it.product_id;

      INSERT INTO public.stock_movements(
        partner_id, product_id, quantity_delta, movement_type,
        reason, reference, created_by
      )
      VALUES (
        r.partner_id, it.product_id, -it.quantity, 'sale',
        'Retrait confirmé', r.id::text, uid
      );
    END LOOP;

    UPDATE public.universe_reservations
    SET status = 'picked_up',
        picked_up_at = now(),
        updated_at = now()
    WHERE id = r.id;
  ELSE
    RAISE EXCEPTION 'Transition de statut non autorisée';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.transition_universe_reservation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_universe_reservation(uuid, text) TO authenticated, service_role;
