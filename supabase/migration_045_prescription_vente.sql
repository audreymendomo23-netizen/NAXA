-- NAXA ERP-004 — Prescription -> vente
-- Additif : conserve le scan/import ordonnance existant et raccorde le parcours à la vente.
-- Les données de santé restent hors de portée du comptable et de l'administration réseau.

do $$ begin
  create type public.prescription_statut as enum ('en_attente','validee','rejetee','expiree');
exception when duplicate_object then null; end $$;

create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  client_id uuid references auth.users(id) on delete set null,
  source text not null default 'client'
    check (source in ('client','pharmacie')),
  document_ref text,
  statut public.prescription_statut not null default 'en_attente',
  motif_rejet text,
  validateur_id uuid references auth.users(id) on delete set null,
  validee_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prescription_rejet_motif_ck
    check (statut <> 'rejetee' or nullif(trim(motif_rejet),'') is not null),
  constraint prescription_validation_ck
    check ((statut = 'validee') = (validee_at is not null and validateur_id is not null))
);

create index if not exists prescriptions_pharmacie_statut_idx
  on public.prescriptions(pharmacie_id, statut, created_at desc);
create index if not exists prescriptions_client_idx
  on public.prescriptions(client_id, created_at desc);

create table if not exists public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  produit_id uuid references public.produits(id) on delete set null,
  designation_prescrite text not null,
  quantite_prescrite integer check (quantite_prescrite is null or quantite_prescrite > 0),
  commentaire_pharmacien text,
  created_at timestamptz not null default now()
);

create index if not exists prescription_items_prescription_idx
  on public.prescription_items(prescription_id);

alter table public.ventes
  add column if not exists prescription_id uuid references public.prescriptions(id) on delete restrict;

create index if not exists ventes_prescription_idx
  on public.ventes(prescription_id);

do $$ begin
  insert into public.naxa_privileges(code,family,description,delegable,governance_only)
  values
    ('VIEW_PRESCRIPTION','SANTE','Consulter une ordonnance dans le périmètre autorisé',false,false),
    ('EDIT_PRESCRIPTION','SANTE','Renseigner les éléments internes d''une ordonnance',false,false),
    ('VALIDATE_PRESCRIPTION','SANTE','Valider ou rejeter une ordonnance',false,false)
  on conflict (code) do nothing;
exception when undefined_table then null; end $$;

alter table public.profiles
  drop constraint if exists profiles_fonction_interne_check;
alter table public.profiles
  add constraint profiles_fonction_interne_check
  check (fonction_interne is null or fonction_interne in (
    'promoteur','responsable','caisse','pharmacien_assistant',
    'manager_regional','chef_agence','custom'
  ));

alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;

revoke all on table public.prescriptions from anon, authenticated;
revoke all on table public.prescription_items from anon, authenticated;
grant insert on table public.prescriptions to authenticated;
grant select,insert,update on table public.prescription_items to authenticated;

drop policy if exists prescriptions_client_submit on public.prescriptions;
create policy prescriptions_client_submit
on public.prescriptions for insert to authenticated
with check (
  (select auth.uid()) = client_id
  and source = 'client'
  and statut = 'en_attente'
  and validateur_id is null
  and validee_at is null
);

drop policy if exists prescriptions_staff_read on public.prescriptions;
create policy prescriptions_staff_read
on public.prescriptions for select to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid())
      and p.actif
      and p.pharmacie_id=prescriptions.pharmacie_id
      and (
        p.role='promoteur'
        or p.fonction_interne='pharmacien_assistant'
      )
  )
);

drop policy if exists prescriptions_staff_update on public.prescriptions;
create policy prescriptions_staff_update
on public.prescriptions for update to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid())
      and p.actif
      and p.pharmacie_id=prescriptions.pharmacie_id
      and (
        p.role='promoteur'
        or p.fonction_interne='pharmacien_assistant'
      )
  )
)
with check (
  pharmacie_id = (select p.pharmacie_id from public.profiles p where p.id=(select auth.uid()) and p.actif)
);

drop policy if exists prescription_items_staff on public.prescription_items;
create policy prescription_items_staff
on public.prescription_items for all to authenticated
using (
  exists (
    select 1
    from public.prescriptions r
    join public.profiles p on p.pharmacie_id=r.pharmacie_id
    where r.id=prescription_items.prescription_id
      and p.id=(select auth.uid())
      and p.actif
      and (p.role='promoteur' or p.fonction_interne='pharmacien_assistant')
  )
)
with check (
  exists (
    select 1
    from public.prescriptions r
    join public.profiles p on p.pharmacie_id=r.pharmacie_id
    where r.id=prescription_items.prescription_id
      and p.id=(select auth.uid())
      and p.actif
      and (p.role='promoteur' or p.fonction_interne='pharmacien_assistant')
  )
);

create or replace function public.prescription_valider(
  p_prescription uuid,
  p_accepter boolean,
  p_motif text default null
)
returns public.prescription_statut
language plpgsql
security definer
set search_path=''
as $$
declare
  v public.prescriptions%rowtype;
  u uuid := (select auth.uid());
  f text;
begin
  if u is null then raise exception 'Connexion requise'; end if;

  select * into v from public.prescriptions
  where id=p_prescription
  for update;

  if not found then raise exception 'Ordonnance introuvable'; end if;

  select p.fonction_interne into f
  from public.profiles p
  where p.id=u and p.actif and p.pharmacie_id=v.pharmacie_id
    and (p.role='promoteur' or p.fonction_interne='pharmacien_assistant');

  if f is null then raise exception 'Validation ordonnance non autorisée'; end if;
  if v.statut <> 'en_attente' then raise exception 'Ordonnance déjà traitée'; end if;

  if p_accepter then
    update public.prescriptions
    set statut='validee', validateur_id=u, validee_at=now(),
        motif_rejet=null, updated_at=now()
    where id=p_prescription;
    return 'validee';
  end if;

  if nullif(trim(coalesce(p_motif,'')),'') is null then
    raise exception 'Motif de rejet obligatoire';
  end if;

  update public.prescriptions
  set statut='rejetee', validateur_id=u, validee_at=null,
      motif_rejet=trim(p_motif), updated_at=now()
  where id=p_prescription;

  return 'rejetee';
end;
$$;

revoke execute on function public.prescription_valider(uuid,boolean,text)
  from public, anon;
grant execute on function public.prescription_valider(uuid,boolean,text)
  to authenticated;

create or replace function public.vente_prescription_guard()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.prescriptions%rowtype;
begin
  if new.prescription_id is null then
    return new;
  end if;

  select * into r from public.prescriptions
  where id=new.prescription_id;

  if not found then raise exception 'Ordonnance introuvable'; end if;
  if r.pharmacie_id <> new.pharmacie_id then
    raise exception 'Ordonnance et vente hors du même périmètre pharmacie';
  end if;
  if r.statut <> 'validee' then
    raise exception 'Vente bloquée : ordonnance non validée';
  end if;
  if r.expires_at is not null and r.expires_at < now() then
    raise exception 'Vente bloquée : ordonnance expirée';
  end if;
  if r.client_id is not null and new.client_id is not null and r.client_id <> new.client_id then
    raise exception 'Ordonnance et client incohérents';
  end if;

  return new;
end;
$$;

revoke execute on function public.vente_prescription_guard() from public,anon,authenticated;

drop trigger if exists trg_vente_prescription_guard on public.ventes;
create trigger trg_vente_prescription_guard
before insert or update of prescription_id,pharmacie_id,client_id
on public.ventes
for each row execute function public.vente_prescription_guard();

create or replace function public.prescriptions_touch()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_prescriptions_touch on public.prescriptions;
create trigger trg_prescriptions_touch
before update on public.prescriptions
for each row execute function public.prescriptions_touch();

revoke execute on function public.prescriptions_touch() from public,anon,authenticated;
