-- NAXA 012a — dépendances minimales des contrôles d'accès multi-pharmacie, copiées de 016
CREATE TABLE IF NOT EXISTS public.promoteur_pharmacies (
  promoteur_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pharmacie_id uuid NOT NULL REFERENCES public.pharmacies(id) ON DELETE CASCADE,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (promoteur_id, pharmacie_id)
);
CREATE INDEX IF NOT EXISTS promoteur_pharmacies_pharmacie_idx ON public.promoteur_pharmacies(pharmacie_id);
ALTER TABLE public.promoteur_pharmacies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS promoteur_pharmacies_admin ON public.promoteur_pharmacies;
CREATE POLICY promoteur_pharmacies_admin ON public.promoteur_pharmacies FOR ALL USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS promoteur_pharmacies_owner ON public.promoteur_pharmacies;
CREATE POLICY promoteur_pharmacies_owner ON public.promoteur_pharmacies FOR SELECT USING (promoteur_id = auth.uid());

CREATE OR REPLACE FUNCTION public.my_pharmacies()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id FROM public.pharmacies p WHERE public.is_admin()
  UNION
  SELECT pp.pharmacie_id FROM public.promoteur_pharmacies pp
   WHERE pp.promoteur_id = auth.uid() AND pp.actif AND public.is_promoteur()
  UNION
  SELECT p.pharmacie_id FROM public.profiles p
   WHERE p.id = auth.uid() AND p.actif AND p.pharmacie_id IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.can_access_pharmacy(p_pharmacie uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_pharmacie IS NOT NULL AND EXISTS (SELECT 1 FROM public.my_pharmacies() x WHERE x = p_pharmacie)
$$;

REVOKE ALL ON FUNCTION public.my_pharmacies() FROM anon;
REVOKE ALL ON FUNCTION public.can_access_pharmacy(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.my_pharmacies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_pharmacy(uuid) TO authenticated;
