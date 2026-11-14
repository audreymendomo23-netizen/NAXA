-- Allow a Promoteur to read only the active pharmacy logos in their own scope.
-- Supabase Storage upserts require INSERT, UPDATE and SELECT visibility on storage.objects.
-- The bucket remains public for public logo delivery; this policy does not widen public access.
begin;

do $policy$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'promoteur_pharmacy_logo_select'
  ) then
    create policy promoteur_pharmacy_logo_select
      on storage.objects
      for select
      to authenticated
      using (
        bucket_id = 'pharmacies-photos'
        and split_part(name, '/', 1) = 'logos'
        and exists (
          select 1
          from public.profiles p
          join public.promoteur_pharmacies pp
            on pp.promoteur_id = p.id
           and pp.actif is true
          join public.pharmacies ph
            on ph.id = pp.pharmacie_id
           and ph.actif is true
          where p.id = (select auth.uid())
            and p.role = 'promoteur'::public.role_type
            and p.actif is true
            and pp.pharmacie_id::text = split_part(objects.name, '/', 2)
        )
      );
  end if;
end
$policy$;

commit;
