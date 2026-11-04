-- NAXA 275 — aligner les lectures directes stock/lots/coûts sur les privilèges métier.
begin;

-- Stock agrégé : consulter exige VIEW_STOCK ; chaque écriture garde son privilège dédié.
drop policy if exists stocks_read on public.stocks;
create policy stocks_read
on public.stocks
for select
to authenticated
using (
  is_admin()
  or public.naxa_has_privilege('VIEW_STOCK',pharmacie_id,'PHARMACIE')
);

drop policy if exists stocks_caisse_update on public.stocks;
create policy stocks_caisse_update
on public.stocks
for update
to authenticated
using (
  is_admin()
  or (
    public.naxa_has_privilege('VIEW_STOCK',pharmacie_id,'PHARMACIE')
    and public.naxa_has_privilege('EDIT_STOCK_QUANTITY',pharmacie_id,'POSTE_CAISSE')
  )
)
with check (
  is_admin()
  or (
    public.naxa_has_privilege('VIEW_STOCK',pharmacie_id,'PHARMACIE')
    and public.naxa_has_privilege('EDIT_STOCK_QUANTITY',pharmacie_id,'POSTE_CAISSE')
  )
);

drop policy if exists stocks_management_insert on public.stocks;
create policy stocks_management_insert
on public.stocks
for insert
to authenticated
with check (
  is_admin()
  or (
    public.naxa_has_privilege('VIEW_STOCK',pharmacie_id,'PHARMACIE')
    and public.naxa_has_privilege('IMPORT_STOCK',pharmacie_id,'PHARMACIE')
  )
);

drop policy if exists stocks_import_update on public.stocks;
create policy stocks_import_update
on public.stocks
for update
to authenticated
using (
  public.naxa_has_privilege('VIEW_STOCK',pharmacie_id,'PHARMACIE')
  and public.naxa_has_privilege('IMPORT_STOCK',pharmacie_id,'PHARMACIE')
)
with check (
  public.naxa_has_privilege('VIEW_STOCK',pharmacie_id,'PHARMACIE')
  and public.naxa_has_privilege('IMPORT_STOCK',pharmacie_id,'PHARMACIE')
);

drop policy if exists stocks_management_delete on public.stocks;
create policy stocks_management_delete
on public.stocks
for delete
to authenticated
using (
  is_admin()
  or (
    public.naxa_has_privilege('VIEW_STOCK',pharmacie_id,'PHARMACIE')
    and public.naxa_has_privilege('MANAGE_STOCK_ANOMALIES',pharmacie_id,'PHARMACIE')
  )
);

-- Lots : retirer la policy ALL qui accordait aussi la lecture à tout opérateur général.
drop policy if exists stocks_lots_equipe on public.stocks_lots;
drop policy if exists stocks_lots_lecture on public.stocks_lots;

create policy stocks_lots_lecture
on public.stocks_lots
for select
to authenticated
using (
  is_admin()
  or public.naxa_has_privilege('VIEW_STOCK',pharmacie_id,'PHARMACIE')
  or public.naxa_has_privilege('MANAGE_LOTS',pharmacie_id,'PHARMACIE')
);

create policy stocks_lots_manage_insert
on public.stocks_lots
for insert
to authenticated
with check (
  is_admin()
  or public.naxa_has_privilege('MANAGE_LOTS',pharmacie_id,'PHARMACIE')
);

create policy stocks_lots_manage_update
on public.stocks_lots
for update
to authenticated
using (
  is_admin()
  or public.naxa_has_privilege('MANAGE_LOTS',pharmacie_id,'PHARMACIE')
)
with check (
  is_admin()
  or public.naxa_has_privilege('MANAGE_LOTS',pharmacie_id,'PHARMACIE')
);

create policy stocks_lots_manage_delete
on public.stocks_lots
for delete
to authenticated
using (
  is_admin()
  or public.naxa_has_privilege('MANAGE_LOTS',pharmacie_id,'PHARMACIE')
);

-- Coûts d'achat et traitements de rappel : appliquer les privilèges explicites déjà utilisés par l'UI.
drop policy if exists stocks_couts_lecture on public.stocks_couts;
create policy stocks_couts_lecture
on public.stocks_couts
for select
to authenticated
using (
  is_admin()
  or public.naxa_has_privilege('VIEW_PURCHASE_COST',pharmacie_id,'PHARMACIE')
);

drop policy if exists stocks_couts_equipe_maj on public.stocks_couts;
create policy stocks_couts_equipe_maj
on public.stocks_couts
for insert
to authenticated
with check (
  is_admin()
  or public.naxa_has_privilege('EDIT_STOCK_PARAMETERS',pharmacie_id,'PHARMACIE')
);

drop policy if exists stocks_couts_equipe_update on public.stocks_couts;
create policy stocks_couts_equipe_update
on public.stocks_couts
for update
to authenticated
using (
  is_admin()
  or public.naxa_has_privilege('EDIT_STOCK_PARAMETERS',pharmacie_id,'PHARMACIE')
)
with check (
  is_admin()
  or public.naxa_has_privilege('EDIT_STOCK_PARAMETERS',pharmacie_id,'PHARMACIE')
);

drop policy if exists rappels_lots_read_scope on public.rappels_lots;
drop policy if exists rappels_lots_scope_read on public.rappels_lots;
create policy rappels_lots_read_scope
on public.rappels_lots
for select
to authenticated
using (
  is_admin()
  or public.naxa_has_privilege('VIEW_STOCK',pharmacie_id,'PHARMACIE')
  or public.naxa_has_privilege('MANAGE_LOTS',pharmacie_id,'PHARMACIE')
);

drop policy if exists rappels_lots_traitements_read on public.rappels_lots_traitements;
create policy rappels_lots_traitements_read
on public.rappels_lots_traitements
for select
to authenticated
using (
  is_admin()
  or public.naxa_has_privilege('MANAGE_LOTS',pharmacie_id,'PHARMACIE')
  or public.naxa_has_privilege('VIEW_PURCHASE_COST',pharmacie_id,'PHARMACIE')
);

commit;
