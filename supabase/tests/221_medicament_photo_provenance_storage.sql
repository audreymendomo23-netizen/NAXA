begin;
do $test$
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='produits' and column_name='photo_path' and data_type='text') then raise exception 'produits.photo_path absent'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='produits' and column_name='photo_source_url' and data_type='text') then raise exception 'produits.photo_source_url absent'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='produits' and column_name='photo_licence' and data_type='text') then raise exception 'produits.photo_licence absent'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='produits' and column_name='photo_verifiee_le' and data_type='timestamp with time zone') then raise exception 'produits.photo_verifiee_le absent'; end if;
  if not exists(select 1 from storage.buckets where id='medicaments' and public=true and file_size_limit=5242880) then raise exception 'bucket medicaments absent ou configuration incorrecte'; end if;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='medicaments_admin_insert') then raise exception 'policy medicaments_admin_insert absente'; end if;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='medicaments_admin_update') then raise exception 'policy medicaments_admin_update absente'; end if;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='medicaments_admin_delete') then raise exception 'policy medicaments_admin_delete absente'; end if;
end;
$test$;
select true as naxa_221_medicament_photo_provenance_storage_pass;
rollback;
