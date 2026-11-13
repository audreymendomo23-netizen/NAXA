create index if not exists partners_admin_location_updated_by_idx
  on public.partners(admin_location_updated_by)
  where admin_location_updated_by is not null;

create index if not exists partners_provider_location_updated_by_idx
  on public.partners(provider_location_updated_by)
  where provider_location_updated_by is not null;
