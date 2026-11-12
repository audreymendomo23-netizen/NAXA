-- NAXA 098 — socle additif des univers, partenaires, flags et journaux.
-- Port de la fondation canonique univers/partenaires dans le dossier rejoué par Supabase Preview.
begin;

-- Public pharmacy catalogue visibility fields referenced by later partner/universe migrations.
-- Existing pharmacies remain visible by default; demo and archived records can be explicitly hidden.
alter table public.pharmacies
  add column if not exists visible_recherche boolean not null default true,
  add column if not exists est_demo boolean not null default false,
  add column if not exists archivee_le timestamptz;

create table if not exists public.universes (
  slug text primary key check (slug in ('parapharmacie','bebe-maman','examens','suivi','prestations','aide')),
  name text not null,
  enabled boolean not null default false,
  display_order smallint not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.universes (slug,name,enabled,display_order) values
 ('parapharmacie','Parapharmacie',false,10),
 ('bebe-maman','Bébé & Maman',false,20),
 ('examens','Examens médicaux',false,30),
 ('suivi','Suivi santé',false,40),
 ('prestations','Prestations à domicile',false,50),
 ('aide','Aide NAXA',true,60)
on conflict (slug) do nothing;

create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 160),
  partner_type text not null check (partner_type in ('parapharmacie','maternite','centre_examen','professionnel_domicile','autre')),
  city text not null default 'Yaoundé',
  neighborhood text,
  address_private text,
  phone_private text,
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.partner_universes (
  partner_id uuid not null references public.partners(id) on delete cascade,
  universe_slug text not null references public.universes(slug) on delete restrict,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (partner_id, universe_slug)
);

create table if not exists public.partner_members (
  partner_id uuid not null references public.partners(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null default 'manager' check (member_role in ('owner','manager','operator','viewer')),
  created_at timestamptz not null default now(),
  primary key (partner_id,user_id)
);

create table if not exists public.feature_flags (
  flag_key text primary key check (flag_key ~ '^[a-z][a-z0-9_.-]{1,95}$'),
  enabled boolean not null default false,
  description text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.feature_flags(flag_key,enabled,description) values
 ('universe.parapharmacie',false,'Active l’espace Parapharmacie'),
 ('universe.bebe-maman',false,'Active l’espace Bébé & Maman'),
 ('universe.examens',false,'Active l’espace Examens médicaux'),
 ('universe.suivi',false,'Active le suivi santé'),
 ('universe.prestations',false,'Active les prestations à domicile'),
 ('tracking.allowlisted_only',true,'Le suivi santé est réservé aux comptes de test autorisés'),
 ('premium.enabled',false,'Fonctionnalités premium désactivées'),
 ('experts.enabled',false,'Espace experts désactivé'),
 ('client_online_payment.enabled',false,'Paiement en ligne client désactivé')
on conflict (flag_key) do nothing;

create table if not exists public.feature_flag_test_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null default 'Compte de test autorisé',
  added_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (length(trim(action)) between 1 and 120),
  entity_type text not null check (length(trim(entity_type)) between 1 and 80),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity_type,entity_id,created_at desc);
create index if not exists partner_members_user_idx on public.partner_members(user_id,partner_id);
create index if not exists partners_status_type_idx on public.partners(status,partner_type);

-- Journal append-only : aucun stock disponible n'est calculé ou modifié par cette table seule.
create table if not exists public.stock_movements (
  id bigint generated always as identity primary key,
  partner_id uuid not null references public.partners(id) on delete restrict,
  product_id uuid not null,
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  movement_type text not null check (movement_type in ('opening','receipt','sale','return','adjustment','loss','transfer_in','transfer_out')),
  reason text,
  reference text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_partner_product_idx on public.stock_movements(partner_id,product_id,created_at desc);

alter table public.universes enable row level security;
alter table public.partners enable row level security;
alter table public.partner_universes enable row level security;
alter table public.partner_members enable row level security;
alter table public.feature_flags enable row level security;
alter table public.feature_flag_test_accounts enable row level security;
alter table public.audit_log enable row level security;
alter table public.stock_movements enable row level security;

-- L'administration existante reste la seule autorité de configuration.
drop policy if exists universes_read_enabled on public.universes;
create policy universes_read_enabled on public.universes for select to anon,authenticated using (enabled = true);
drop policy if exists universes_admin_all on public.universes;
create policy universes_admin_all on public.universes for all to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

drop policy if exists partners_admin_all on public.partners;
create policy partners_admin_all on public.partners for all to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists partners_member_read on public.partners;
create policy partners_member_read on public.partners for select to authenticated
using (exists (select 1 from public.partner_members pm where pm.partner_id=id and pm.user_id=auth.uid()) and status='active');

drop policy if exists partner_universes_admin_all on public.partner_universes;
create policy partner_universes_admin_all on public.partner_universes for all to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists partner_universes_member_read on public.partner_universes;
create policy partner_universes_member_read on public.partner_universes for select to authenticated
using (exists (select 1 from public.partner_members pm join public.partners pa on pa.id=pm.partner_id where pm.partner_id=partner_universes.partner_id and pm.user_id=auth.uid() and pa.status='active'));

drop policy if exists partner_members_admin_all on public.partner_members;
create policy partner_members_admin_all on public.partner_members for all to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists partner_members_self_read on public.partner_members;
create policy partner_members_self_read on public.partner_members for select to authenticated using (user_id=auth.uid());

drop policy if exists feature_flags_admin_all on public.feature_flags;
create policy feature_flags_admin_all on public.feature_flags for all to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists feature_flag_test_accounts_admin_all on public.feature_flag_test_accounts;
create policy feature_flag_test_accounts_admin_all on public.feature_flag_test_accounts for all to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

drop policy if exists audit_log_admin_read on public.audit_log;
create policy audit_log_admin_read on public.audit_log for select to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists audit_log_admin_insert on public.audit_log;
create policy audit_log_admin_insert on public.audit_log for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') and (actor_id is null or actor_id=auth.uid()));
drop policy if exists stock_movements_admin_all on public.stock_movements;
create policy stock_movements_admin_all on public.stock_movements for all to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
with check (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists stock_movements_partner_read on public.stock_movements;
create policy stock_movements_partner_read on public.stock_movements for select to authenticated
using (exists (select 1 from public.partner_members pm join public.partners pa on pa.id=pm.partner_id where pm.partner_id=stock_movements.partner_id and pm.user_id=auth.uid() and pa.status='active'));
drop policy if exists stock_movements_partner_insert on public.stock_movements;
create policy stock_movements_partner_insert on public.stock_movements for insert to authenticated
with check (
  created_by=auth.uid()
  and exists (select 1 from public.partner_members pm join public.partners pa on pa.id=pm.partner_id where pm.partner_id=stock_movements.partner_id and pm.user_id=auth.uid() and pm.member_role in ('owner','manager','operator') and pa.status='active')
);

-- Grants explicites minimaux. Les règles RLS ci-dessus limitent les lignes.
grant select on public.universes to anon,authenticated;
grant insert,update,delete on public.universes,public.partners,public.partner_universes,public.partner_members,public.feature_flags,public.feature_flag_test_accounts to authenticated;
grant select on public.partners,public.partner_universes,public.partner_members,public.feature_flags,public.feature_flag_test_accounts,public.audit_log,public.stock_movements to authenticated;
grant insert on public.audit_log,public.stock_movements to authenticated;
revoke update,delete on public.audit_log,public.stock_movements from anon,authenticated;
revoke all on public.universes,public.partners,public.partner_universes,public.partner_members,public.feature_flags,public.feature_flag_test_accounts,public.audit_log,public.stock_movements from anon;
grant select on public.universes to anon;

commit;
