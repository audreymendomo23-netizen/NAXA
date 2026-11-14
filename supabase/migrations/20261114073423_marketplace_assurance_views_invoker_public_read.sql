-- NAXA — limiter les projections Assurance publiques et respecter la RLS.
begin;

drop policy if exists assureurs_marketplace_public_read on public.assureurs;
create policy assureurs_marketplace_public_read
  on public.assureurs for select to anon
  using (actif is true);

do $revoke_columns$
declare v_column record;
begin
  revoke all privileges on table public.assurance_conventions from anon;
  for v_column in
    select attname from pg_attribute
    where attrelid='public.assurance_conventions'::regclass
      and attnum>0 and not attisdropped
  loop
    execute format(
      'revoke select (%1$I), references (%1$I) on table public.assurance_conventions from anon',
      v_column.attname
    );
  end loop;
end;
$revoke_columns$;

grant select (pharmacie_id, assureur_id, date_debut, date_fin)
  on table public.assurance_conventions to anon;

drop policy if exists assurance_conventions_marketplace_public_read
  on public.assurance_conventions;
create policy assurance_conventions_marketplace_public_read
  on public.assurance_conventions for select to anon
  using (
    statut='active'
    and date_debut<=current_date
    and (date_fin is null or date_fin>=current_date)
    and exists (
      select 1 from public.pharmacies p
      where p.id=assurance_conventions.pharmacie_id
        and p.actif is true
        and p.visible_recherche is true
        and p.est_demo is false
        and p.archivee_le is null
    )
  );

alter view public.marketplace_assureurs
  set (security_barrier=true, security_invoker=true);
alter view public.marketplace_assurance_conventions
  set (security_barrier=true, security_invoker=true);

grant select on public.marketplace_assureurs to anon, authenticated;
grant select on public.marketplace_assurance_conventions to anon, authenticated;
commit;
