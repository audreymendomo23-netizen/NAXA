-- NAXA 016 — BI/RLS multi-pharmacie
DO $$ BEGIN
  ALTER TYPE public.role_type ADD VALUE IF NOT EXISTS 'responsable';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

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

DROP POLICY IF EXISTS rapports_lecture ON public.rapports;
CREATE POLICY rapports_lecture ON public.rapports FOR SELECT USING (
  public.is_admin() OR public.can_access_pharmacy(COALESCE(scope_pharmacie_id, pharmacie_id))
);

DROP POLICY IF EXISTS resa_read ON public.reservations;
CREATE POLICY resa_read ON public.reservations FOR SELECT USING (
  client_id = auth.uid() OR public.can_access_pharmacy(pharmacie_id) OR public.is_admin()
);

DROP POLICY IF EXISTS stocks_read ON public.stocks;
CREATE POLICY stocks_read ON public.stocks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.pharmacies ph WHERE ph.id = stocks.pharmacie_id AND ph.actif)
  OR public.can_access_pharmacy(pharmacie_id) OR public.is_admin()
);
DROP POLICY IF EXISTS stocks_write ON public.stocks;
CREATE POLICY stocks_write ON public.stocks FOR ALL USING (public.can_access_pharmacy(pharmacie_id) OR public.is_admin()) WITH CHECK (public.can_access_pharmacy(pharmacie_id) OR public.is_admin());

DROP POLICY IF EXISTS stocks_lots_equipe ON public.stocks_lots;
CREATE POLICY stocks_lots_equipe ON public.stocks_lots FOR ALL USING (public.can_access_pharmacy(pharmacie_id) OR public.is_admin()) WITH CHECK (public.can_access_pharmacy(pharmacie_id) OR public.is_admin());

DROP VIEW IF EXISTS bi.activite_mensuelle;
CREATE VIEW bi.activite_mensuelle WITH (security_invoker=true) AS
SELECT date_trunc('month',r.created_at)::date mois, r.pharmacie_id, ph.nom pharmacie, ph.quartier, ph.ville,
       count(*)::integer reservations,
       count(*) FILTER (WHERE r.statut IN ('retiree','payee'))::integer ventes,
       coalesce(sum(r.total) FILTER (WHERE r.statut IN ('retiree','payee')),0)::integer ca
FROM public.reservations r JOIN public.pharmacies ph ON ph.id=r.pharmacie_id
WHERE ph.est_demo IS NOT TRUE GROUP BY 1,2,3,4,5;

DROP VIEW IF EXISTS bi.stock_pharmacies;
CREATE VIEW bi.stock_pharmacies WITH (security_invoker=true) AS
SELECT ph.id pharmacie_id, ph.nom pharmacie, ph.quartier, ph.ville, ph.actif, ph.stock_updated_at,
       count(s.produit_id) FILTER (WHERE s.quantite > 0)::integer produits_en_stock,
       count(s.produit_id) FILTER (WHERE s.quantite = 0)::integer produits_en_rupture
FROM public.pharmacies ph LEFT JOIN public.stocks s ON s.pharmacie_id=ph.id
WHERE ph.est_demo IS NOT TRUE GROUP BY ph.id,ph.nom,ph.quartier,ph.ville,ph.actif,ph.stock_updated_at;

REVOKE ALL ON FUNCTION public.my_pharmacies() FROM anon;
REVOKE ALL ON FUNCTION public.can_access_pharmacy(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.my_pharmacies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_pharmacy(uuid) TO authenticated;