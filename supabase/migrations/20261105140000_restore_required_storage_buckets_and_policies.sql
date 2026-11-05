-- NAXA — restore Storage buckets required by the live application flows.
-- Idempotent and additive: no objects are deleted or made public beyond the
-- two image buckets whose public URLs are explicitly consumed by the UI.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('pharmacies-photos', 'pharmacies-photos', true, 524288, array['image/jpeg','image/png','image/webp']),
  ('medicaments', 'medicaments', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'promoteur_pharmacy_logo_insert'
  ) then
    create policy promoteur_pharmacy_logo_insert
    on storage.objects for insert to authenticated
    with check (
      bucket_id = 'pharmacies-photos'
      and split_part(name, '/', 1) = 'logos'
      and exists (
        select 1
        from public.profiles p
        join public.promoteur_pharmacies pp
          on pp.promoteur_id = p.id and pp.actif is true
        join public.pharmacies ph
          on ph.id = pp.pharmacie_id and ph.actif is true
        where p.id = auth.uid()
          and p.role = 'promoteur'::public.role_type
          and p.actif is true
          and pp.pharmacie_id::text = split_part(name, '/', 2)
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'promoteur_pharmacy_logo_update'
  ) then
    create policy promoteur_pharmacy_logo_update
    on storage.objects for update to authenticated
    using (
      bucket_id = 'pharmacies-photos'
      and split_part(name, '/', 1) = 'logos'
      and exists (
        select 1
        from public.profiles p
        join public.promoteur_pharmacies pp
          on pp.promoteur_id = p.id and pp.actif is true
        join public.pharmacies ph
          on ph.id = pp.pharmacie_id and ph.actif is true
        where p.id = auth.uid()
          and p.role = 'promoteur'::public.role_type
          and p.actif is true
          and pp.pharmacie_id::text = split_part(name, '/', 2)
      )
    )
    with check (
      bucket_id = 'pharmacies-photos'
      and split_part(name, '/', 1) = 'logos'
      and exists (
        select 1
        from public.profiles p
        join public.promoteur_pharmacies pp
          on pp.promoteur_id = p.id and pp.actif is true
        join public.pharmacies ph
          on ph.id = pp.pharmacie_id and ph.actif is true
        where p.id = auth.uid()
          and p.role = 'promoteur'::public.role_type
          and p.actif is true
          and pp.pharmacie_id::text = split_part(name, '/', 2)
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'promoteur_pharmacy_logo_delete'
  ) then
    create policy promoteur_pharmacy_logo_delete
    on storage.objects for delete to authenticated
    using (
      bucket_id = 'pharmacies-photos'
      and split_part(name, '/', 1) = 'logos'
      and exists (
        select 1
        from public.profiles p
        join public.promoteur_pharmacies pp
          on pp.promoteur_id = p.id and pp.actif is true
        join public.pharmacies ph
          on ph.id = pp.pharmacie_id and ph.actif is true
        where p.id = auth.uid()
          and p.role = 'promoteur'::public.role_type
          and p.actif is true
          and pp.pharmacie_id::text = split_part(name, '/', 2)
      )
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'medicaments_public_read'
  ) then
    create policy medicaments_public_read
    on storage.objects for select
    using (bucket_id = 'medicaments');
  end if;
end
$$;
