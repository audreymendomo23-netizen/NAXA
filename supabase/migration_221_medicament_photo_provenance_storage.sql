-- NAXA 221 — provenance, droits et stockage des photos de médicaments.
-- Migration additive : ne remplace ni les produits existants ni les photos déjà renseignées.
begin;

alter table public.produits
  add column if not exists photo_path text,
  add column if not exists photo_source_url text,
  add column if not exists photo_licence text,
  add column if not exists photo_verifiee_le timestamptz;

comment on column public.produits.photo_path is
  'Chemin dans le bucket Storage medicaments. Afficher une copie locale seulement après vérification des droits.';
comment on column public.produits.photo_source_url is
  'URL de la source originale de la photo, conservée pour audit de provenance.';
comment on column public.produits.photo_licence is
  'Licence ou autorisation documentée permettant la réutilisation commerciale de la photo.';
comment on column public.produits.photo_verifiee_le is
  'Date de validation de l association entre image, médicament et droits de réutilisation.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medicaments', 'medicaments', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','image/webp'];

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='medicaments_public_read') then
    create policy medicaments_public_read on storage.objects
      for select using (bucket_id = 'medicaments');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='medicaments_admin_insert') then
    create policy medicaments_admin_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'medicaments'
        and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='medicaments_admin_update') then
    create policy medicaments_admin_update on storage.objects
      for update to authenticated
      using (
        bucket_id = 'medicaments'
        and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      )
      with check (
        bucket_id = 'medicaments'
        and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='medicaments_admin_delete') then
    create policy medicaments_admin_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'medicaments'
        and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
      );
  end if;
end
$$;

commit;
