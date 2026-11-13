-- NAXA — une politique SELECT unique évite le chevauchement des règles de lecture des modèles.
-- Les utilisateurs authentifiés lisent les modèles publiés ; les Admins actifs lisent aussi
-- les versions brouillon et archivées pour consulter le texte exact signé.
drop policy if exists partner_independent_templates_admin_archived_read on public.partner_independent_agreement_templates;
drop policy if exists partner_independent_templates_published_read on public.partner_independent_agreement_templates;

create policy partner_independent_templates_read
  on public.partner_independent_agreement_templates
  for select to authenticated
  using (
    status='published'
    or (
      status in ('draft','archived')
      and exists(
        select 1 from public.profiles p
        where p.id=(select auth.uid()) and p.role='admin' and p.actif=true
      )
    )
  );

create index if not exists partner_independent_templates_created_by_idx
  on public.partner_independent_agreement_templates(created_by);
create index if not exists partner_independent_templates_published_by_idx
  on public.partner_independent_agreement_templates(published_by);
create index if not exists partner_independent_agreements_template_idx
  on public.partner_independent_agreements(template_id);
create index if not exists partner_independent_agreements_accepted_by_idx
  on public.partner_independent_agreements(accepted_by);
create index if not exists partner_independent_agreements_approved_by_idx
  on public.partner_independent_agreements(approved_by);
create index if not exists partner_independent_agreements_revoked_by_idx
  on public.partner_independent_agreements(revoked_by);
