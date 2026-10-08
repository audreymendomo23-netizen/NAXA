-- NAXA ERP-003 — POS étapes 7/8/9
-- Paiements avancés + caisse rapide + remises/promotions.
-- Extension additive : aucun second moteur de vente.

-- 7. Paiements avancés : assurance/voucher utilisent le mode existant `autre`.
-- Les étiquettes dédiées pourront être ajoutées séparément sans bloquer ce chantier.

create table if not exists public.vente_vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  montant_initial integer not null check (montant_initial > 0),
  solde integer not null check (solde >= 0 and solde <= montant_initial),
  actif boolean not null default true,
  expires_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.vente_vouchers enable row level security;
create index if not exists vente_vouchers_scope_idx
  on public.vente_vouchers(pharmacie_id, actif, expires_at);

drop policy if exists vente_vouchers_read on public.vente_vouchers;
create policy vente_vouchers_read on public.vente_vouchers
  for select to authenticated
  using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

revoke all on public.vente_vouchers from anon,authenticated;
grant select on public.vente_vouchers to authenticated;

create or replace function public.vente_payer_voucher(
  p_vente uuid,p_voucher uuid,p_montant integer
)
returns void
language plpgsql
security definer
set search_path=''
as $voucher$
declare v_vente public.ventes%rowtype; v public.vente_vouchers%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_montant <= 0 then raise exception 'Montant invalide'; end if;
  select * into v_vente from public.ventes where id=p_vente for update;
  if not found or v_vente.statut <> 'brouillon' then raise exception 'Vente invalide'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then raise exception 'Vente hors périmètre'; end if;
  select * into v from public.vente_vouchers where id=p_voucher and pharmacie_id=v_vente.pharmacie_id for update;
  if not found or not v.actif then raise exception 'Voucher invalide'; end if;
  if v.expires_at is not null and v.expires_at < now() then raise exception 'Voucher expiré'; end if;
  if p_montant > v.solde then raise exception 'Solde voucher insuffisant'; end if;
  perform public.vente_ajouter_paiement(p_vente,'autre',p_montant,'VOUCHER:'||v.code);
  update public.vente_vouchers set solde=solde-p_montant, actif=(solde-p_montant)>0 where id=v.id;
end;
$voucher$;

revoke all on function public.vente_payer_voucher(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.vente_payer_voucher(uuid,uuid,integer) to authenticated;

-- Assurance : un dossier existant devient la source du montant tiers payant.
alter table public.dossiers_assurance
  add column if not exists vente_paiement_id uuid references public.vente_paiements(id) on delete set null;

create or replace function public.vente_payer_assurance(
  p_vente uuid,p_dossier uuid,p_montant integer
)
returns void
language plpgsql
security definer
set search_path=''
as $assurance$
declare v_vente public.ventes%rowtype; d public.dossiers_assurance%rowtype;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_montant <= 0 then raise exception 'Montant invalide'; end if;
  select * into v_vente from public.ventes where id=p_vente for update;
  if not found or v_vente.statut <> 'brouillon' then raise exception 'Vente invalide'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then raise exception 'Vente hors périmètre'; end if;
  select * into d from public.dossiers_assurance where id=p_dossier and pharmacie_id=v_vente.pharmacie_id for update;
  if not found or d.statut not in ('accepte','clos') then raise exception 'Dossier assurance non accepté'; end if;
  if d.vente_id is not null and d.vente_id<>p_vente then raise exception 'Dossier rattaché à une autre vente'; end if;
  if d.montant_prise_en_charge is null or p_montant>d.montant_prise_en_charge then raise exception 'Montant assurance supérieur à la prise en charge'; end if;
  perform public.vente_ajouter_paiement(p_vente,'assurance',p_montant,coalesce(d.reference_externe,'ASS-'||perform public.vente_ajouter_paiement(p_vente,'autre',p_montant,'ASSURANCE:'||coalesce(d.reference_externe,'ASS-'||d.id::text));
  update public.dossiers_assurance set vente_id=p_vente where id=d.id;
end;
$assurance$;

revoke all on function public.vente_payer_assurance(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.vente_payer_assurance(uuid,uuid,integer) to authenticated;

-- Réconciliation du crédit existant : passage par vente_paiements pour rester compatible
-- avec la finalisation/mixité du moteur POS.
create or replace function public.client_credit_enregistrer_vente(
  p_vente uuid,p_montant integer,p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $credit$
declare v_vente public.ventes%rowtype; v_credit public.client_credits%rowtype; v_op uuid; v_new integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into v_vente from public.ventes where id=p_vente for update;
  if not found or v_vente.client_id is null then raise exception 'Vente/client requis'; end if;
  if v_vente.statut <> 'brouillon' then raise exception 'Vente déjà finalisée'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then raise exception 'Pharmacie hors périmètre'; end if;
  if p_montant<>v_vente.total_net then raise exception 'Le crédit doit couvrir le solde total de la vente'; end if;
  select * into v_credit from public.client_credits
    where client_id=v_vente.client_id and pharmacie_id=v_vente.pharmacie_id and actif for update;
  if not found then raise exception 'Crédit client non activé'; end if;
  v_new:=v_credit.solde+p_montant;
  if v_new>v_credit.plafond and not exists(
    select 1 from public.client_credit_requests q
    where q.vente_id=p_vente and q.statut='approuvee' and q.consumed_at is null
  ) then raise exception 'Plafond dépassé : approbation requise'; end if;
  perform public.vente_ajouter_paiement(p_vente,'credit',p_montant,nullif(trim(p_reference),''));
  update public.client_credits set solde=v_new,updated_at=now() where id=v_credit.id;
  update public.client_credit_requests set consumed_at=now()
    where vente_id=p_vente and statut='approuvee' and consumed_at is null;
  insert into public.client_credit_operations(credit_id,pharmacie_id,client_id,vente_id,nature,montant,reference,created_by)
  values(v_credit.id,v_vente.pharmacie_id,v_vente.client_id,p_vente,'credit',p_montant,nullif(trim(p_reference),''),auth.uid())
  returning id into v_op;
  return v_op;
end;
$credit$;

-- 8. Caisse rapide : favoris, paniers en attente et affichage client.
create table if not exists public.pos_favoris (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  produit_id uuid not null references public.produits(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique(pharmacie_id,user_id,produit_id)
);

create table if not exists public.pos_paniers_attente (
  id uuid primary key default gen_random_uuid(),
  vente_id uuid not null unique references public.ventes(id) on delete cascade,
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  libelle text,
  mis_en_attente_par uuid not null references auth.users(id),
  mis_en_attente_at timestamptz not null default now(),
  repris_at timestamptz,
  repris_par uuid references auth.users(id)
);

create table if not exists public.pos_affichage_client (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  session_id uuid not null unique references public.caisses_sessions(id) on delete cascade,
  vente_id uuid references public.ventes(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.pos_favoris enable row level security;
alter table public.pos_paniers_attente enable row level security;
alter table public.pos_affichage_client enable row level security;

create policy pos_favoris_scope on public.pos_favoris for all to authenticated
using (user_id=(select auth.uid()) and (public.is_admin() or public.can_access_pharmacy(pharmacie_id)))
with check (user_id=(select auth.uid()) and (public.is_admin() or public.can_access_pharmacy(pharmacie_id)));

create policy pos_paniers_scope on public.pos_paniers_attente for all to authenticated
using (public.is_admin() or public.can_access_pharmacy(pharmacie_id))
with check (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

create policy pos_affichage_scope on public.pos_affichage_client for all to authenticated
using (public.is_admin() or public.can_access_pharmacy(pharmacie_id))
with check (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

create or replace function public.pos_panier_mettre_attente(p_vente uuid,p_libelle text default null)
returns void
language plpgsql security definer set search_path=''
as $hold$
declare v public.ventes%rowtype;
begin
 select * into v from public.ventes where id=p_vente for update;
 if not found or v.statut<>'brouillon' then raise exception 'Vente invalide'; end if;
 if not(public.is_admin() or public.can_operate_pharmacy(v.pharmacie_id)) then raise exception 'Vente hors périmètre'; end if;
 insert into public.pos_paniers_attente(vente_id,pharmacie_id,libelle,mis_en_attente_par)
 values(v.id,v.pharmacie_id,nullif(trim(p_libelle),''),auth.uid())
 on conflict(vente_id) do update set libelle=excluded.libelle,mis_en_attente_par=excluded.mis_en_attente_par,mis_en_attente_at=now(),repris_at=null,repris_par=null;
end;
$hold$;

create or replace function public.pos_panier_reprendre(p_vente uuid)
returns void language plpgsql security definer set search_path=''
as $resume$
declare v public.ventes%rowtype;
begin
 select * into v from public.ventes where id=p_vente for update;
 if not found or v.statut<>'brouillon' then raise exception 'Vente invalide'; end if;
 if not(public.is_admin() or public.can_operate_pharmacy(v.pharmacie_id)) then raise exception 'Vente hors périmètre'; end if;
 update public.pos_paniers_attente set repris_at=now(),repris_par=auth.uid() where vente_id=p_vente;
end;
$resume$;

create or replace function public.pos_affichage_client_update(
  p_session uuid,p_vente uuid,p_payload jsonb
)
returns void language plpgsql security definer set search_path=''
as $display$
declare v_pharmacie uuid;
begin
 select c.pharmacie_id into v_pharmacie from public.caisses_sessions s join public.caisses c on c.id=s.caisse_id where s.id=p_session;
 if v_pharmacie is null or not(public.is_admin() or public.can_operate_pharmacy(v_pharmacie)) then raise exception 'Session hors périmètre'; end if;
 insert into public.pos_affichage_client(pharmacie_id,session_id,vente_id,payload)
 values(v_pharmacie,p_session,p_vente,coalesce(p_payload,'{}'::jsonb))
 on conflict(session_id) do update set vente_id=excluded.vente_id,payload=excluded.payload,updated_at=now();
end;
$display$;

revoke all on function public.pos_panier_mettre_attente(uuid,text) from public,anon,authenticated;
revoke all on function public.pos_panier_reprendre(uuid) from public,anon,authenticated;
revoke all on function public.pos_affichage_client_update(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.pos_panier_mettre_attente(uuid,text) to authenticated;
grant execute on function public.pos_panier_reprendre(uuid) to authenticated;
grant execute on function public.pos_affichage_client_update(uuid,uuid,jsonb) to authenticated;

-- 9. Remises/promotions : limites explicites et approbation séparée.
create table if not exists public.pos_promotions (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  nom text not null,
  type text not null check (type in ('pourcentage','montant')),
  valeur integer not null check (valeur>0),
  plafond integer check (plafond is null or plafond>0),
  approbation_requise boolean not null default true,
  actif boolean not null default true,
  date_debut timestamptz not null default now(),
  date_fin timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (date_fin is null or date_fin>=date_debut),
  check (type<>'pourcentage' or valeur<=100)
);

create table if not exists public.pos_remise_demandes (
  id uuid primary key default gen_random_uuid(),
  vente_id uuid not null references public.ventes(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  promotion_id uuid references public.pos_promotions(id) on delete restrict,
  montant integer not null check (montant>0),
  statut text not null default 'en_attente' check(statut in('en_attente','approuvee','rejetee')),
  demandee_par uuid not null references auth.users(id),
  decidee_par uuid references auth.users(id),
  decidee_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists pos_remise_active_uq
on public.pos_remise_demandes(vente_id) where statut='en_attente';

alter table public.pos_promotions enable row level security;
alter table public.pos_remise_demandes enable row level security;

create policy pos_promotions_read on public.pos_promotions for select to authenticated
using (actif and (public.is_admin() or public.can_access_pharmacy(pharmacie_id)));
create policy pos_remise_read on public.pos_remise_demandes for select to authenticated
using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));

revoke all on public.pos_promotions,public.pos_remise_demandes from anon,authenticated;
grant select on public.pos_promotions,public.pos_remise_demandes to authenticated;

create or replace function public.vente_remise_demander(
  p_vente uuid,p_montant integer,p_promotion uuid default null
)
returns uuid language plpgsql security definer set search_path=''
as $rem_req$
declare v public.ventes%rowtype; pr public.pos_promotions%rowtype; id uuid;
begin
 select * into v from public.ventes where id=p_vente for update;
 if not found or v.statut<>'brouillon' then raise exception 'Vente invalide'; end if;
 if not(public.is_admin() or public.can_operate_pharmacy(v.pharmacie_id)) then raise exception 'Vente hors périmètre'; end if;
 if p_montant<=0 or p_montant>v.total_brut then raise exception 'Remise invalide'; end if;
 if p_promotion is not null then
   select * into pr from public.pos_promotions where id=p_promotion and pharmacie_id=v.pharmacie_id and actif
     and now()>=date_debut and (date_fin is null or now()<=date_fin);
   if not found then raise exception 'Promotion inactive ou hors période'; end if;
   if pr.type='pourcentage' and p_montant>floor(v.total_brut*pr.valeur/100) then raise exception 'Remise supérieure à la promotion'; end if;
   if pr.plafond is not null and p_montant>pr.plafond then raise exception 'Plafond de promotion dépassé'; end if;
 end if;
 insert into public.pos_remise_demandes(vente_id,pharmacie_id,promotion_id,montant,demandee_par)
 values(p_vente,v.pharmacie_id,p_promotion,p_montant,auth.uid()) returning id into id;
 return id;
end;
$rem_req$;

create or replace function public.vente_remise_decider(p_demande uuid,p_approuver boolean)
returns void language plpgsql security definer set search_path=''
as $rem_dec$
declare r public.pos_remise_demandes%rowtype; v public.ventes%rowtype;
begin
 select * into r from public.pos_remise_demandes where id=p_demande for update;
 if not found or r.statut<>'en_attente' then raise exception 'Demande introuvable ou déjà traitée'; end if;
 if not public.is_admin() and r.demandee_par=auth.uid() then raise exception 'Auto-approbation interdite'; end if;
 if not public.is_admin() and not exists(select 1 from public.profiles p where p.id=auth.uid() and p.actif and p.role::text='promoteur' and p.niveau_interne=1) then
   raise exception 'Décision réservée au Promoteur ou NAXA';
 end if;
 if not public.is_admin() and not public.can_access_pharmacy(r.pharmacie_id) then raise exception 'Hors périmètre'; end if;
 update public.pos_remise_demandes set statut=case when p_approuver then 'approuvee' else 'rejetee' end,decidee_par=auth.uid(),decidee_at=now() where id=r.id;
 if p_approuver then
   update public.ventes set remise=remise+r.montant,total_net=greatest(total_brut-(remise+r.montant),0) where id=r.vente_id;
 end if;
end;
$rem_dec$;

revoke all on function public.vente_remise_demander(uuid,integer,uuid) from public,anon,authenticated;
revoke all on function public.vente_remise_decider(uuid,boolean) from public,anon,authenticated;
grant execute on function public.vente_remise_demander(uuid,integer,uuid) to authenticated;
grant execute on function public.vente_remise_decider(uuid,boolean) to authenticated;

create index if not exists pos_promotions_scope_idx on public.pos_promotions(pharmacie_id,actif,date_debut,date_fin);
