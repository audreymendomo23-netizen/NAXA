-- NAXA — éviter les politiques SELECT permissives qui se chevauchent sur les modèles.
-- Les utilisateurs authentifiés lisent uniquement la version publiée.
-- Les Admins actifs peuvent aussi lire les versions brouillon/archivées pour audit.
-- Les écritures passent par la RPC SECURITY DEFINER dédiée.
drop policy if exists partner_independent_templates_admin_manage on public.partner_independent_agreement_templates;
drop policy if exists partner_independent_templates_admin_archived_read on public.partner_independent_agreement_templates;

create policy partner_independent_templates_admin_archived_read
  on public.partner_independent_agreement_templates
  for select to authenticated
  using (
    status in ('draft','archived')
    and exists(
      select 1 from public.profiles p
      where p.id=(select auth.uid()) and p.role='admin' and p.actif=true
    )
  );
