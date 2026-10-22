begin;
create table if not exists public.pharmacie_documents_recus (
  pharmacie_id uuid primary key references public.pharmacies(id) on delete cascade,
  piece_existence_legale boolean not null default false,
  registre_commerce boolean not null default false,
  niu boolean not null default false,
  attestation_non_redevance boolean not null default false,
  plan_localisation boolean not null default false,
  cni_promoteur boolean not null default false,
  mis_a_jour_par uuid references auth.users(id) on delete set null,
  mis_a_jour_le timestamptz not null default now()
);
alter table public.pharmacie_documents_recus enable row level security;
drop policy if exists pharmacie_documents_recus_admin_select on public.pharmacie_documents_recus;
create policy pharmacie_documents_recus_admin_select on public.pharmacie_documents_recus for select to authenticated using (public.is_admin());
drop policy if exists pharmacie_documents_recus_admin_insert on public.pharmacie_documents_recus;
create policy pharmacie_documents_recus_admin_insert on public.pharmacie_documents_recus for insert to authenticated with check (public.is_admin());
drop policy if exists pharmacie_documents_recus_admin_update on public.pharmacie_documents_recus;
create policy pharmacie_documents_recus_admin_update on public.pharmacie_documents_recus for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists pharmacie_documents_recus_admin_delete on public.pharmacie_documents_recus;
create policy pharmacie_documents_recus_admin_delete on public.pharmacie_documents_recus for delete to authenticated using (public.is_admin());
revoke all on public.pharmacie_documents_recus from anon, authenticated;
grant select, insert, update, delete on public.pharmacie_documents_recus to authenticated;
commit;
