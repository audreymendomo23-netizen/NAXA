-- NAXA 20261024 — le poste Comptable consulte les fournisseurs/commandes, sans les modifier.
-- Le privilège MANAGE_ACCOUNTING ne confère pas de droit d'écriture sur les sources opérationnelles.
begin;

drop policy if exists commandes_fournisseurs_scope on public.commandes_fournisseurs;
drop policy if exists commandes_fournisseurs_read_scope on public.commandes_fournisseurs;
drop policy if exists commandes_fournisseurs_insert_scope on public.commandes_fournisseurs;
drop policy if exists commandes_fournisseurs_update_scope on public.commandes_fournisseurs;
drop policy if exists commandes_fournisseurs_delete_scope on public.commandes_fournisseurs;

create policy commandes_fournisseurs_read_scope
on public.commandes_fournisseurs for select to authenticated
using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

create policy commandes_fournisseurs_insert_scope
on public.commandes_fournisseurs for insert to authenticated
with check (
  public.is_admin()
  or (
    public.can_access_pharmacy(pharmacie_id)
    and not coalesce(public.naxa_can('MANAGE_ACCOUNTING', pharmacie_id, null), false)
  )
);

create policy commandes_fournisseurs_update_scope
on public.commandes_fournisseurs for update to authenticated
using (
  public.is_admin()
  or (
    public.can_access_pharmacy(pharmacie_id)
    and not coalesce(public.naxa_can('MANAGE_ACCOUNTING', pharmacie_id, null), false)
  )
)
with check (
  public.is_admin()
  or (
    public.can_access_pharmacy(pharmacie_id)
    and not coalesce(public.naxa_can('MANAGE_ACCOUNTING', pharmacie_id, null), false)
  )
);

create policy commandes_fournisseurs_delete_scope
on public.commandes_fournisseurs for delete to authenticated
using (
  public.is_admin()
  or (
    public.can_access_pharmacy(pharmacie_id)
    and not coalesce(public.naxa_can('MANAGE_ACCOUNTING', pharmacie_id, null), false)
  )
);

drop policy if exists fournisseurs_scope on public.fournisseurs;
drop policy if exists fournisseurs_read_scope on public.fournisseurs;
drop policy if exists fournisseurs_insert_scope on public.fournisseurs;
drop policy if exists fournisseurs_update_scope on public.fournisseurs;
drop policy if exists fournisseurs_delete_scope on public.fournisseurs;

create policy fournisseurs_read_scope
on public.fournisseurs for select to authenticated
using (
  public.is_admin()
  or created_by = auth.uid()
  or exists (
    select 1 from public.commandes_fournisseurs c
    where c.fournisseur_id = fournisseurs.id
      and public.can_access_pharmacy(c.pharmacie_id)
  )
);

create policy fournisseurs_insert_scope
on public.fournisseurs for insert to authenticated
with check (
  public.is_admin()
  or (
    created_by = auth.uid()
    and not coalesce(public.naxa_can('MANAGE_ACCOUNTING', public.my_pharmacie(), null), false)
  )
);

create policy fournisseurs_update_scope
on public.fournisseurs for update to authenticated
using (
  public.is_admin()
  or (
    created_by = auth.uid()
    and not coalesce(public.naxa_can('MANAGE_ACCOUNTING', public.my_pharmacie(), null), false)
  )
  or exists (
    select 1 from public.commandes_fournisseurs c
    where c.fournisseur_id = fournisseurs.id
      and public.can_access_pharmacy(c.pharmacie_id)
      and not coalesce(public.naxa_can('MANAGE_ACCOUNTING', c.pharmacie_id, null), false)
  )
)
with check (
  public.is_admin()
  or (
    created_by = auth.uid()
    and not coalesce(public.naxa_can('MANAGE_ACCOUNTING', public.my_pharmacie(), null), false)
  )
  or exists (
    select 1 from public.commandes_fournisseurs c
    where c.fournisseur_id = fournisseurs.id
      and public.can_access_pharmacy(c.pharmacie_id)
      and not coalesce(public.naxa_can('MANAGE_ACCOUNTING', c.pharmacie_id, null), false)
  )
);

create policy fournisseurs_delete_scope
on public.fournisseurs for delete to authenticated
using (
  public.is_admin()
  or (
    created_by = auth.uid()
    and not coalesce(public.naxa_can('MANAGE_ACCOUNTING', public.my_pharmacie(), null), false)
  )
  or exists (
    select 1 from public.commandes_fournisseurs c
    where c.fournisseur_id = fournisseurs.id
      and public.can_access_pharmacy(c.pharmacie_id)
      and not coalesce(public.naxa_can('MANAGE_ACCOUNTING', c.pharmacie_id, null), false)
  )
);

commit;
