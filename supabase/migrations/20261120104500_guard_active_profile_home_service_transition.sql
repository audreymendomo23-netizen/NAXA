CREATE OR REPLACE FUNCTION public.transition_home_service_request(
  p_request_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_request public.home_service_requests%rowtype;
  v_is_admin boolean;
  v_can_manage boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Connexion requise'; END IF;

  -- Une suspension globale bloque aussi les actions Client de résiliation.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id=v_uid AND pr.actif IS TRUE
  ) THEN
    RAISE EXCEPTION 'Profil inactif ou suspendu';
  END IF;

  SELECT * INTO v_request
  FROM public.home_service_requests
  WHERE id=p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demande introuvable'; END IF;

  v_is_admin := public.is_admin();
  SELECT EXISTS (
    SELECT 1
    FROM public.partner_members pm
    JOIN public.partners pa ON pa.id=pm.partner_id
    JOIN public.profiles pr ON pr.id=pm.user_id AND pr.actif=true
    WHERE pm.partner_id=v_request.partner_id
      AND pm.user_id=v_uid
      AND pm.member_role IN ('owner','manager','operator')
      AND pa.status='active'
      AND pa.partner_type='professionnel_domicile'
  ) INTO v_can_manage;

  IF p_status='cancelled'
     AND v_request.client_id=v_uid
     AND v_request.status IN ('requested','confirmed') THEN
    UPDATE public.home_service_requests
    SET status='cancelled',updated_at=now()
    WHERE id=v_request.id;
    INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,metadata)
    VALUES(v_uid,'home_service.cancelled','home_service_request',v_request.id::text,'{"by":"client"}'::jsonb);
    RETURN;
  END IF;

  IF NOT (v_is_admin OR v_can_manage) THEN
    RAISE EXCEPTION 'Action non autorisée' USING errcode='42501';
  END IF;
  IF p_status='confirmed' THEN
    RAISE EXCEPTION 'Utilisez confirm_home_service_appointment pour confirmer avec un créneau';
  END IF;
  IF v_request.status IN ('completed','cancelled','expired') THEN
    RAISE EXCEPTION 'Demande déjà clôturée';
  END IF;
  IF p_status='completed' AND v_request.status='confirmed' THEN
    UPDATE public.home_service_requests
    SET status='completed',completed_at=now(),updated_at=now()
    WHERE id=v_request.id;
  ELSE
    RAISE EXCEPTION 'Transition de statut non autorisée';
  END IF;
  INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  VALUES(v_uid,'home_service.'||p_status,'home_service_request',v_request.id::text,
    jsonb_build_object('partner_id',v_request.partner_id));
END;
$function$;
REVOKE ALL ON FUNCTION public.transition_home_service_request(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transition_home_service_request(uuid,text) TO authenticated, service_role;