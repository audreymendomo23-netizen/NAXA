-- NAXA 273 — autoriser l'upsert d'import sur les stocks existants uniquement avec IMPORT_STOCK.
begin;

drop policy if exists stocks_import_update on public.stocks;

create policy stocks_import_update
on public.stocks
for update
to authenticated
using (
  public.naxa_has_privilege('IMPORT_STOCK',pharmacie_id,'PHARMACIE')
)
with check (
  public.naxa_has_privilege('IMPORT_STOCK',pharmacie_id,'PHARMACIE')
);

commit;
