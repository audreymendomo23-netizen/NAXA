-- NAXA 017 — moteur hiérarchique, accréditations et durcissement RLS
CREATE OR REPLACE FUNCTION public.is_promoteur()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.profiles
  WHERE id=(SELECT auth.uid()) AND role='promoteur' AND actif=true
) $$;

CREATE TABLE IF NOT EXISTS public.profile_accreditations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grantor_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  target_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  pharmacie_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE RESTRICT,
  niveau smallint NOT NULL CHECK (niveau IN (2,3)),
  active boolean NOT NULL DEFAULT true,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (target_profile_id, pharmacie_id, niveau, granted_at)
);
CREATE INDEX IF NOT EXISTS profile_accreditations_target_idx ON public.profile_accreditations(target_profile_id,active);
CREATE INDEX IF NOT EXISTS profile_accreditations_grantor_idx ON public.profile_accreditations(grantor_profile_id,active);
CREATE INDEX IF NOT EXISTS profile_accreditations_pharmacie_idx ON public.profile_accreditations(pharmacie_id,active);
ALTER TABLE public.profile_accreditations ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_profile(p_target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT
  EXISTS (SELECT 1 FROM public.profiles a WHERE a.id=(SELECT auth.uid()) AND a.role='admin' AND a.actif=true)
  OR EXISTS (
    SELECT 1 FROM public.profiles a JOIN public.profiles t ON t.id=p_target
    WHERE a.id=(SELECT auth.uid()) AND a.role='promoteur' AND a.actif=true
      AND t.parent_profile_id=a.id AND t.actif=true
  ) $$;

CREATE OR REPLACE FUNCTION public.accrediter_profile(p_target uuid,p_pharmacie uuid,p_niveau smallint,p_parent uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_id uuid; v_role public.role_type;
BEGIN
  IF NOT public.is_admin() AND NOT public.is_promoteur() THEN RAISE EXCEPTION 'Accréditation non autorisée'; END IF;
  IF p_niveau NOT IN (2,3) THEN RAISE EXCEPTION 'Niveau invalide'; END IF;
  IF p_parent IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles parent WHERE parent.id=p_parent AND parent.actif=true AND parent.pharmacie_id=p_pharmacie AND parent.role::text IN ('promoteur','responsable')) THEN RAISE EXCEPTION 'Parent invalide'; END IF;
  IF p_niveau=3 AND p_parent IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles parent WHERE parent.id=p_parent AND parent.role::text='responsable') THEN RAISE EXCEPTION 'Parent Responsable requis'; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id=p_target AND actif=true;
  IF v_role IS NULL OR (p_niveau=2 AND v_role::text <> 'responsable') OR (p_niveau=3 AND v_role::text <> 'caisse') THEN
    RAISE EXCEPTION 'Niveau et rôle incompatibles';
  END IF;
  IF NOT public.is_admin() AND NOT EXISTS (
    SELECT 1 FROM public.promoteur_pharmacies pp
    WHERE pp.promoteur_id=(SELECT auth.uid()) AND pp.pharmacie_id=p_pharmacie AND pp.actif=true
  ) THEN RAISE EXCEPTION 'Pharmacie hors périmètre Promoteur'; END IF;
  INSERT INTO public.profile_accreditations(grantor_profile_id,target_profile_id,pharmacie_id,niveau)
  VALUES((SELECT auth.uid()),p_target,p_pharmacie,p_niveau) RETURNING id INTO v_id;
  UPDATE public.profiles SET parent_profile_id=COALESCE(p_parent,(SELECT auth.uid())),pharmacie_id=p_pharmacie,actif=true WHERE id=p_target;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.retirer_accreditation(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_target uuid;
BEGIN
  SELECT target_profile_id INTO v_target FROM public.profile_accreditations WHERE id=p_id AND active=true;
  IF v_target IS NULL THEN RAISE EXCEPTION 'Accréditation introuvable'; END IF;
  IF NOT public.is_admin() AND NOT EXISTS (
    SELECT 1 FROM public.profile_accreditations a WHERE a.id=p_id AND a.grantor_profile_id=(SELECT auth.uid())
  ) THEN RAISE EXCEPTION 'Révocation non autorisée'; END IF;
  UPDATE public.profile_accreditations SET active=false,revoked_at=now(),revoked_by=(SELECT auth.uid()) WHERE id=p_id;
  UPDATE public.profiles SET actif=false WHERE id=v_target;
END $$;

CREATE OR REPLACE FUNCTION public.can_operate_pharmacy(p_pharmacie uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT public.can_access_pharmacy(p_pharmacie)
 AND EXISTS (SELECT 1 FROM public.pharmacies ph WHERE ph.id=p_pharmacie AND ph.actif=true)
 AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.actif=true AND p.role::text IN ('promoteur','responsable','caisse','pharmacie','admin')) $$;

DROP POLICY IF EXISTS stocks_write ON public.stocks;
CREATE POLICY stocks_write ON public.stocks FOR ALL TO authenticated
USING (public.can_operate_pharmacy(pharmacie_id) OR public.is_admin())
WITH CHECK (public.can_operate_pharmacy(pharmacie_id) OR public.is_admin());

DROP POLICY IF EXISTS stocks_read ON public.stocks;
CREATE POLICY stocks_read ON public.stocks FOR SELECT TO authenticated
USING ((public.can_access_pharmacy(pharmacie_id) OR public.is_admin()));

DROP POLICY IF EXISTS stocks_lots_equipe ON public.stocks_lots;
CREATE POLICY stocks_lots_equipe ON public.stocks_lots FOR ALL TO authenticated
USING (public.can_operate_pharmacy(pharmacie_id) OR public.is_admin())
WITH CHECK (public.can_operate_pharmacy(pharmacie_id) OR public.is_admin());

DROP POLICY IF EXISTS profile_accreditations_admin ON public.profile_accreditations;
DROP POLICY IF EXISTS pharmacie_privee_scope ON public.pharmacie_privee;
CREATE POLICY pharmacie_privee_scope ON public.pharmacie_privee FOR SELECT TO authenticated USING (public.is_admin() OR public.can_access_pharmacy(pharmacie_id));
CREATE POLICY profile_accreditations_admin ON public.profile_accreditations FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS profile_accreditations_parties ON public.profile_accreditations;
CREATE POLICY profile_accreditations_parties ON public.profile_accreditations FOR SELECT TO authenticated
USING (grantor_profile_id=(SELECT auth.uid()) OR target_profile_id=(SELECT auth.uid()));

REVOKE ALL ON public.profile_accreditations FROM anon,authenticated;
GRANT SELECT ON public.profile_accreditations TO authenticated;
REVOKE ALL ON public.stocks FROM anon;
REVOKE ALL ON public.stocks_lots FROM anon;
REVOKE ALL ON public.pharmacie_privee FROM anon;
REVOKE ALL ON public.recherche_events FROM anon,authenticated;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
REVOKE ALL ON FUNCTION public.is_promoteur() FROM anon;
REVOKE ALL ON FUNCTION public.my_pharmacie() FROM anon;
REVOKE ALL ON FUNCTION public.initialiser_abonnement_pharmacie() FROM anon,authenticated;
REVOKE ALL ON FUNCTION public.declare_payment(uuid,text) FROM anon;
REVOKE ALL ON FUNCTION public.reactiver_pharmacie(uuid,text) FROM anon;
REVOKE ALL ON FUNCTION public.stats_admin(integer) FROM anon;
REVOKE ALL ON FUNCTION public.stats_pharmacie(uuid,integer) FROM anon;
REVOKE ALL ON FUNCTION public.validites_pharmacies_admin() FROM anon;
REVOKE ALL ON FUNCTION public.set_garde(boolean) FROM anon;

REVOKE ALL ON FUNCTION public.can_manage_profile(uuid) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.accrediter_profile(uuid,uuid,smallint,uuid) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.retirer_accreditation(uuid) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.can_operate_pharmacy(uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accrediter_profile(uuid,uuid,smallint,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retirer_accreditation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_operate_pharmacy(uuid) TO authenticated;
