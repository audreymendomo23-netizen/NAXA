-- NAXA 197 — restreindre le répertoire fournisseur aux comptes ERP autorisés.
begin;
drop policy if exists fournisseurs_scope on public.fournisseurs;
drop policy if exists fournisseurs_read_staff on public.fournisseurs;
drop policy if exists fournisseurs_insert_staff on public.fournisseurs;
drop policy if exists fournisseurs_update_staff on public.fournisseurs;
drop policy if exists fournisseurs_delete_staff on public.fournisseurs;

create policy fournisseurs_read_staff on public.fournisseurs
 for select to authenticated using (
  public.is_admin()
  or exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.actif=true
    and (coalesce(p.role::text,'') in ('promoteur','admin')
      or coalesce(p.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')))
  or exists(select 1 from public.commandes_fournisseurs c where c.fournisseur_id=fournisseurs.id and public.naxa_scope_allows((select auth.uid()),c.pharmacie_id,'PHARMACIE'))
 );
create policy fournisseurs_insert_staff on public.fournisseurs
 for insert to authenticated with check (
  created_by=(select auth.uid())
  and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.actif=true
    and (coalesce(p.role::text,'') in ('promoteur','admin')
      or coalesce(p.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')))
 );
create policy fournisseurs_update_staff on public.fournisseurs
 for update to authenticated using (
  public.is_admin() or (created_by=(select auth.uid()) and exists(
   select 1 from public.profiles p where p.id=(select auth.uid()) and p.actif=true
    and (coalesce(p.role::text,'') in ('promoteur','admin')
      or coalesce(p.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier'))))
 ) with check (
  public.is_admin() or (created_by=(select auth.uid()) and exists(
   select 1 from public.profiles p where p.id=(select auth.uid()) and p.actif=true
    and (coalesce(p.role::text,'') in ('promoteur','admin')
      or coalesce(p.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier'))))
 );
create policy fournisseurs_delete_staff on public.fournisseurs
 for delete to authenticated using (
  public.is_admin() or (created_by=(select auth.uid()) and exists(
   select 1 from public.profiles p where p.id=(select auth.uid()) and p.actif=true
    and (coalesce(p.role::text,'') in ('promoteur','admin')
      or coalesce(p.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier'))))
 );
commit;
