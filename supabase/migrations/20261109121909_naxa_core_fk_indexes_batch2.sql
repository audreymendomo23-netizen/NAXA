-- Replay verified migration; source-controlled on QA only.
-- 22 missing full, left-prefix FK indexes across active NAXA workflows.
-- Existing composite and partial indexes were excluded when they already cover
-- the FK values that can be non-NULL.
CREATE INDEX IF NOT EXISTS idx_reservations_delivery_quote_id
  ON public.reservations USING btree (delivery_quote_id);
CREATE INDEX IF NOT EXISTS idx_naxa_profile_active_roles_role_code
  ON public.naxa_profile_active_roles USING btree (role_code);
CREATE INDEX IF NOT EXISTS idx_naxa_profile_active_roles_pharmacie_id
  ON public.naxa_profile_active_roles USING btree (pharmacie_id);
CREATE INDEX IF NOT EXISTS idx_naxa_professional_assignments_accorde_par
  ON public.naxa_professional_assignments USING btree (accorde_par);
CREATE INDEX IF NOT EXISTS idx_naxa_professional_assignments_role_code
  ON public.naxa_professional_assignments USING btree (role_code);
CREATE INDEX IF NOT EXISTS idx_naxa_professional_assignments_revoque_par
  ON public.naxa_professional_assignments USING btree (revoque_par);
CREATE INDEX IF NOT EXISTS idx_ventes_client_id
  ON public.ventes USING btree (client_id);
CREATE INDEX IF NOT EXISTS idx_ventes_created_by
  ON public.ventes USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_client_credit_requests_decided_by
  ON public.client_credit_requests USING btree (decided_by);
CREATE INDEX IF NOT EXISTS idx_client_credit_requests_credit_id
  ON public.client_credit_requests USING btree (credit_id);
CREATE INDEX IF NOT EXISTS idx_client_credit_requests_vente_id
  ON public.client_credit_requests USING btree (vente_id);
CREATE INDEX IF NOT EXISTS idx_client_credit_requests_requested_by
  ON public.client_credit_requests USING btree (requested_by);
CREATE INDEX IF NOT EXISTS idx_vente_lignes_vente_id
  ON public.vente_lignes USING btree (vente_id);
CREATE INDEX IF NOT EXISTS idx_alertes_pharmacie_id
  ON public.alertes USING btree (pharmacie_id);
CREATE INDEX IF NOT EXISTS idx_evenements_pharmacie_id
  ON public.evenements USING btree (pharmacie_id);
CREATE INDEX IF NOT EXISTS idx_evenements_produit_id
  ON public.evenements USING btree (produit_id);
CREATE INDEX IF NOT EXISTS idx_rappels_lots_compte_par
  ON public.rappels_lots USING btree (compte_par);
CREATE INDEX IF NOT EXISTS idx_rappels_lots_created_by
  ON public.rappels_lots USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_rappels_lots_leve_par
  ON public.rappels_lots USING btree (leve_par);
CREATE INDEX IF NOT EXISTS idx_rappels_lots_lot_id
  ON public.rappels_lots USING btree (lot_id);
CREATE INDEX IF NOT EXISTS idx_stock_manager_movement_journal_acteur_id
  ON public.stock_manager_movement_journal USING btree (acteur_id);
CREATE INDEX IF NOT EXISTS idx_stock_manager_movement_journal_produit_id
  ON public.stock_manager_movement_journal USING btree (produit_id);
