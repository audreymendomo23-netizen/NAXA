-- NAXA ERP-010 — fiche client / crédit (F68)
-- Fondation additive. Aucun doublon de profil client : auth.users/profiles reste la source d'identité.
-- Le crédit commercial est séparé des données de santé et du coffre ordonnance.

do $$ begin
  alter type public.mode_paiement_caisse add value if not exists 'credit';
exception when duplicate_object then null; end $$;

create table if not exists public.client_fiches (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  reference_client text,
  notes_commerciales text,
  actif boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(client_id, pharmacie_id),
  unique(pharmacie_id, id)
);

create table if not exists public.client_credits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  plafond integer not null default 0 check (plafond >= 0),
  solde integer not null default 0 check (solde >= 0),
  actif boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_at timestamptz not null default now(),
  unique(client_id, pharmacie_id),
  unique(pharmacie_id, id)
);

create table if not exists public.client_credit_operations (
  id uuid primary key default gen_random_uuid(),
  credit_id uuid not null references public.client_credits(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  client_id uuid not null references auth.users(id) on delete restrict,
  vente_id uuid references public.ventes(id) on delete restrict,
  nature text not null check (nature in ('credit','remboursement','ajustement')),
  montant integer not null check (montant > 0),
  reference text,
  motif text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists client_fiches_scope_idx on public.client_fiches(pharmacie_id, actif);
create index if not exists client_credits_scope_idx on public.client_credits(pharmacie_id, actif);
create index if not exists client_credit_ops_scope_idx on public.client_credit_operations(pharmacie_id, created_at desc);
create unique index if not exists client_credit_sale_unique
  on public.client_credit_operations(vente_id)
  where nature='credit' and vente_id is not null;

alter table public.client_fiches enable row level security;
alter table public.client_credits enable row level security;
alter table public.client_credit_operations enable row level security;

drop policy if exists client_fiches_read on public.client_fiches;
create policy client_fiches_read on public.client_fiches for select to authenticated
using (
  client_id=(select auth.uid())
  or public.is_admin()
  or public.can_access_pharmacy(pharmacie_id)
);

drop policy if exists client_credits_read on public.client_credits;
create policy client_credits_read on public.client_credits for select to authenticated
using (
  client_id=(select auth.uid())
  or public.is_admin()
  or public.can_access_pharmacy(pharmacie_id)
);

drop policy if exists client_credit_operations_read on public.client_credit_operations;
create policy client_credit_operations_read on public.client_credit_operations for select to authenticated
using (
  client_id=(select auth.uid())
  or public.is_admin()
  or public.can_access_pharmacy(pharmacie_id)
);

revoke all on public.client_fiches, public.client_credits, public.client_credit_operations from anon, authenticated;
grant select on public.client_fiches, public.client_credits, public.client_credit_operations to authenticated;

create or replace function public.client_credit_configurer(
  p_client uuid,
  p_pharmacie uuid,
  p_plafond integer
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_plafond < 0 then raise exception 'Plafond invalide'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(p_pharmacie)) then
    raise exception 'Pharmacie hors périmètre';
  end if;
  insert into public.client_fiches(client_id,pharmacie_id,created_by)
  values(p_client,p_pharmacie,auth.uid())
  on conflict(client_id,pharmacie_id) do nothing;

  insert into public.client_credits(client_id,pharmacie_id,plafond,created_by)
  values(p_client,p_pharmacie,p_plafond,auth.uid())
  on conflict(client_id,pharmacie_id) do update
    set plafond=excluded.plafond, actif=true, updated_at=now()
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.client_credit_enregistrer_vente(
  p_vente uuid,
  p_montant integer,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_vente public.ventes%rowtype;
  v_credit public.client_credits%rowtype;
  v_op uuid;
  v_new_solde integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_montant <= 0 then raise exception 'Montant invalide'; end if;

  select * into v_vente from public.ventes where id=p_vente for update;
  if not found then raise exception 'Vente introuvable'; end if;
  if v_vente.client_id is null then raise exception 'Client requis pour un crédit'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then
    raise exception 'Pharmacie hors périmètre';
  end if;
  if p_montant <> v_vente.total_net then raise exception 'Montant différent du total de vente'; end if;
  if v_vente.statut <> 'brouillon' then raise exception 'Vente déjà finalisée'; end if;

  select * into v_credit
  from public.client_credits
  where client_id=v_vente.client_id and pharmacie_id=v_vente.pharmacie_id and actif
  for update;

  if not found then raise exception 'Crédit client non activé'; end if;
  v_new_solde := v_credit.solde + p_montant;
  if v_new_solde > v_credit.plafond then
    raise exception 'Plafond de crédit dépassé';
  end if;

  update public.ventes
    set statut='payee', mode_paiement='credit', paid_at=now()
  where id=v_vente.id;

  update public.client_credits
    set solde=v_new_solde, updated_at=now()
  where id=v_credit.id;

  insert into public.client_credit_operations(
    credit_id,pharmacie_id,client_id,vente_id,nature,montant,reference,created_by
  ) values(
    v_credit.id,v_vente.pharmacie_id,v_vente.client_id,v_vente.id,'credit',p_montant,
    nullif(trim(p_reference),''),auth.uid()
  ) returning id into v_op;

  return v_op;
end
$$;

create or replace function public.client_credit_rembourser(
  p_credit uuid,
  p_montant integer,
  p_reference text default null,
  p_motif text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_credit public.client_credits%rowtype; v_op uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_montant <= 0 then raise exception 'Montant invalide'; end if;
  select * into v_credit from public.client_credits where id=p_credit for update;
  if not found then raise exception 'Crédit introuvable'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_credit.pharmacie_id)) then
    raise exception 'Pharmacie hors périmètre';
  end if;
  if p_montant > v_credit.solde then raise exception 'Remboursement supérieur au solde'; end if;

  update public.client_credits
    set solde=solde-p_montant, updated_at=now()
  where id=v_credit.id;

  insert into public.client_credit_operations(
    credit_id,pharmacie_id,client_id,nature,montant,reference,motif,created_by
  ) values(
    v_credit.id,v_credit.pharmacie_id,v_credit.client_id,'remboursement',p_montant,
    nullif(trim(p_reference),''),nullif(trim(p_motif),''),auth.uid()
  ) returning id into v_op;
  return v_op;
end
$$;

revoke all on function public.client_credit_configurer(uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.client_credit_enregistrer_vente(uuid,integer,text) from public,anon,authenticated;
revoke all on function public.client_credit_rembourser(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.client_credit_configurer(uuid,uuid,integer) to authenticated;
grant execute on function public.client_credit_enregistrer_vente(uuid,integer,text) to authenticated;
grant execute on function public.client_credit_rembourser(uuid,integer,text,text) to authenticated;

comment on table public.client_credit_operations is
'Journal commercial de crédit client. Ne contient aucune donnée de santé ni contenu d ordonnance.';
