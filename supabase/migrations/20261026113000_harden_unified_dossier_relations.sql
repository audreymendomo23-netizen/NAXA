begin;

-- Reconcile les environnements où la migration de base a déjà été rejouée
-- avant l'ajout des index et de la FK du service pharmacie.
create index if not exists admin_partner_dossiers_created_by_idx
  on public.admin_partner_dossiers(created_by);
create index if not exists pharmacie_services_enabled_by_idx
  on public.pharmacie_services(enabled_by);
create index if not exists pharmacie_services_updated_by_idx
  on public.pharmacie_services(updated_by);

do $migration$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='pharmacie_services_service_slug_fkey'
      and conrelid='public.pharmacie_services'::regclass
  ) then
    alter table public.pharmacie_services
      add constraint pharmacie_services_service_slug_fkey
      foreign key (service_slug) references public.universes(slug) on delete restrict;
  end if;
end
$migration$;

commit;
