begin;
create or replace function public.naxa_stock_manager_actor(p_pharmacie uuid)
returns boolean language sql stable security definer set search_path=''
as $f$
 select auth.uid() is not null
 and public.can_access_pharmacy(p_pharmacie)
 and exists(select 1 from public.profiles p where p.id=auth.uid() and p.actif=true
  and (coalesce(p.role::text,'') in ('admin','promoteur')
   or coalesce(p.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')));
$f$;
revoke all on function public.naxa_stock_manager_actor(uuid) from public,anon;
grant execute on function public.naxa_stock_manager_actor(uuid) to authenticated;

-- Les commandes ne peuvent être créées qu'en brouillon; leur transition est réservée à la RPC.
drop policy if exists commandes_fournisseurs_scope on public.commandes_fournisseurs;
drop policy if exists commandes_fournisseurs_read_staff on public.commandes_fournisseurs;
drop policy if exists commandes_fournisseurs_insert_draft on public.commandes_fournisseurs;
create policy commandes_fournisseurs_read_staff on public.commandes_fournisseurs
 for select to authenticated using(public.is_admin() or public.naxa_stock_manager_actor(pharmacie_id));
create policy commandes_fournisseurs_insert_draft on public.commandes_fournisseurs
 for insert to authenticated with check(
  (public.is_admin() or public.naxa_stock_manager_actor(pharmacie_id))
  and statut='brouillon' and created_by=(select auth.uid())
 );

drop policy if exists commandes_fournisseurs_lignes_scope on public.commandes_fournisseurs_lignes;
drop policy if exists commandes_fournisseurs_lignes_read_staff on public.commandes_fournisseurs_lignes;
drop policy if exists commandes_fournisseurs_lignes_insert_draft on public.commandes_fournisseurs_lignes;
create policy commandes_fournisseurs_lignes_read_staff on public.commandes_fournisseurs_lignes
 for select to authenticated using(exists(
  select 1 from public.commandes_fournisseurs c where c.id=commande_id
   and (public.is_admin() or public.naxa_stock_manager_actor(c.pharmacie_id))));
create policy commandes_fournisseurs_lignes_insert_draft on public.commandes_fournisseurs_lignes
 for insert to authenticated with check(exists(
  select 1 from public.commandes_fournisseurs c where c.id=commande_id and c.statut='brouillon'
   and (public.is_admin() or public.naxa_stock_manager_actor(c.pharmacie_id))));

create or replace function public.fournisseur_commande_envoyer(p_commande uuid)
returns boolean language plpgsql security definer set search_path=''
as $f$
declare v_order public.commandes_fournisseurs%rowtype; v_user uuid:=auth.uid();
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 select * into v_order from public.commandes_fournisseurs where id=p_commande for update;
 if not found or not (public.is_admin() or public.naxa_stock_manager_actor(v_order.pharmacie_id)) then
  raise exception 'Commande fournisseur hors périmètre';
 end if;
 if v_order.statut<>'brouillon' then raise exception 'Seul un brouillon peut être marqué comme envoyé'; end if;
 if not exists(select 1 from public.commandes_fournisseurs_lignes l where l.commande_id=p_commande) then
  raise exception 'Ajoutez au moins une ligne avant l’envoi';
 end if;
 update public.commandes_fournisseurs set statut='envoyee',updated_at=now() where id=p_commande;
 return true;
end;
$f$;
revoke all on function public.fournisseur_commande_envoyer(uuid) from public,anon;
grant execute on function public.fournisseur_commande_envoyer(uuid) to authenticated;
revoke update,delete on public.commandes_fournisseurs from public,anon,authenticated;
revoke update,delete on public.commandes_fournisseurs_lignes from public,anon,authenticated;
drop policy if exists receptions_fournisseurs_scope on public.receptions_fournisseurs;
drop policy if exists receptions_fournisseurs_read_scope on public.receptions_fournisseurs;
create policy receptions_fournisseurs_read_scope on public.receptions_fournisseurs
 for select to authenticated using(public.is_admin() or public.can_access_pharmacy(pharmacie_id));
drop policy if exists receptions_fournisseurs_lignes_scope on public.receptions_fournisseurs_lignes;
drop policy if exists receptions_fournisseurs_lignes_read_scope on public.receptions_fournisseurs_lignes;
create policy receptions_fournisseurs_lignes_read_scope on public.receptions_fournisseurs_lignes
 for select to authenticated using(exists(select 1 from public.receptions_fournisseurs r where r.id=receptions_fournisseurs_lignes.reception_id and (public.is_admin() or public.can_access_pharmacy(r.pharmacie_id))));
revoke insert,update,delete on public.receptions_fournisseurs,public.receptions_fournisseurs_lignes from public,anon,authenticated;
grant select on public.receptions_fournisseurs,public.receptions_fournisseurs_lignes to authenticated;
revoke insert,update,delete on public.inventaires,public.inventaire_lignes from public,anon,authenticated;
grant select on public.inventaires,public.inventaire_lignes to authenticated;
commit;
