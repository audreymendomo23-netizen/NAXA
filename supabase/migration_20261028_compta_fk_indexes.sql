-- NAXA Comptable — index couvrants pour les clés étrangères comptables.
-- Migration additive : améliore les recherches et évite les scans lors des
-- contrôles de références. Aucun index existant n'est supprimé.
begin;

create index if not exists compta_audit_acteur_idx
  on public.compta_audit (acteur_id);

create index if not exists compta_controles_cloture_controle_par_idx
  on public.compta_controles_cloture (controle_par);

create index if not exists compta_controles_cloture_periode_pharmacie_fk_idx
  on public.compta_controles_cloture (periode_id, pharmacie_id);

create index if not exists compta_ecriture_contrepassation_pharmacie_fk_idx
  on public.compta_ecriture (contrepassation_de, pharmacie_id);

create index if not exists compta_ecriture_cree_par_idx
  on public.compta_ecriture (cree_par);

create index if not exists compta_ecriture_periode_pharmacie_fk_idx
  on public.compta_ecriture (periode_id, pharmacie_id);

create index if not exists compta_ligne_compte_pharmacie_fk_idx
  on public.compta_ligne (compte_id, pharmacie_id);

create index if not exists compta_ligne_ecriture_pharmacie_fk_idx
  on public.compta_ligne (ecriture_id, pharmacie_id);

create index if not exists compta_mapping_compte_compte_pharmacie_fk_idx
  on public.compta_mapping_compte (compte_id, pharmacie_id);

create index if not exists compta_mapping_compte_valide_par_idx
  on public.compta_mapping_compte (valide_par);

create index if not exists compta_parametre_valide_par_idx
  on public.compta_parametre (valide_par);

create index if not exists compta_periodes_cloturee_par_idx
  on public.compta_periodes (cloturee_par);

create index if not exists compta_plan_comptable_valide_par_idx
  on public.compta_plan_comptable (valide_par);

commit;
