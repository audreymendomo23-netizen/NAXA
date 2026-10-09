-- Vérifie que le schéma historique des lots est compatible avec migration 043.
do $$
declare
  required_column text;
begin
  foreach required_column in array array['id','pharmacie_id','produit_id','numero_lot','date_peremption','quantite','bloque','motif_blocage','created_at','updated_at']
  loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='stocks_lots' and column_name=required_column
    ) then
      raise exception 'stocks_lots.% absent après migration de compatibilité', required_column;
    end if;
  end loop;
end
$$;
