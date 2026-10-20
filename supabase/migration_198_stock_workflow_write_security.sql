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

drop policy if exists commandes_fournisseurs_scope on public.commandes_fournisseurs;
create policy commandes_fournisseurs_scope on public.commandes_fournisseurs
 for all to authenticated using(public.is_admin() or public.naxa_stock_manager_actor(pharmacie_id))
 with check(public.is_admin() or public.naxa_stock_manager_actor(pharmacie_id));
drop policy if exists commandes_fournisseurs_lignes_scope on public.commandes_fournisseurs_lignes;
create policy commandes_fournisseurs_lignes_scope on public.commandes_fournisseurs_lignes
 for all to authenticated using(exists(select 1 from public.commandes_fournisseurs c where c.id=commande_id and (public.is_admin() or public.naxa_stock_manager_actor(c.pharmacie_id))))
 with check(exists(select 1 from public.commandes_fournisseurs c where c.id=commande_id and (public.is_admin() or public.naxa_stock_manager_actor(c.pharmacie_id))));

drop policy if exists receptions_fournisseurs_scope on public.receptions_fournisseurs;
create policy receptions_fournisseurs_read_scope on public.receptions_fournisseurs
 for select to authenticated using(public.is_admin() or public.can_access_pharmacy(pharmacie_id));
drop policy if exists receptions_fournisseurs_lignes_scope on public.receptions_fournisseurs_lignes;
create policy receptions_fournisseurs_lignes_read_scope on public.receptions_fournisseurs_lignes
 for select to authenticated using(exists(select 1 from public.receptions_fournisseurs r where r.id=receptions_fournisseurs_lignes.reception_id and (public.is_admin() or public.can_access_pharmacy(r.pharmacie_id))));
revoke insert,update,delete on public.receptions_fournisseurs,public.receptions_fournisseurs_lignes from anon,authenticated;
grant select on public.receptions_fournisseurs,public.receptions_fournisseurs_lignes to authenticated;
revoke insert,update,delete on public.inventaires,public.inventaire_lignes from anon,authenticated;
grant select on public.inventaires,public.inventaire_lignes to authenticated;
commit;
