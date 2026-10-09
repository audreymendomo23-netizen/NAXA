-- NAXA ERP-010 — raccorder le crédit client au flux de paiement POS existant.
-- Additif : le modèle ventes reste la source d'état ; aucun fichier de migration antérieur n'est modifié.
create table if not exists public.vente_paiements (
  id uuid primary key default gen_random_uuid(),
  vente_id uuid not null references public.ventes(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  montant integer not null check (montant > 0),
  mode_paiement public.mode_paiement_caisse not null,
  reference text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists vente_paiements_vente_idx
  on public.vente_paiements(vente_id, created_at);
create index if not exists vente_paiements_pharmacie_idx
  on public.vente_paiements(pharmacie_id, created_at desc);

alter table public.vente_paiements enable row level security;
drop policy if exists vente_paiements_scope_read on public.vente_paiements;
create policy vente_paiements_scope_read on public.vente_paiements
for select to authenticated
using (public.is_admin() or public.can_access_pharmacy(pharmacie_id));
revoke all on public.vente_paiements from anon, authenticated;
grant select on public.vente_paiements to authenticated;

create or replace function public.vente_ajouter_paiement(
  p_vente uuid,
  p_montant integer,
  p_mode public.mode_paiement_caisse,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $naxa$
declare
  v_vente public.ventes%rowtype;
  v_paiement uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'Montant de paiement invalide'; end if;
  if p_mode is null then raise exception 'Mode de paiement requis'; end if;

  select * into v_vente from public.ventes where id=p_vente for update;
  if not found then raise exception 'Vente introuvable'; end if;
  if v_vente.statut <> 'brouillon' then raise exception 'Vente déjà finalisée'; end if;
  if p_montant <> v_vente.total_net then raise exception 'Le paiement doit couvrir le total net de la vente'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then
    raise exception 'Pharmacie hors périmètre';
  end if;

  insert into public.vente_paiements(vente_id,pharmacie_id,montant,mode_paiement,reference,created_by)
  values(v_vente.id,v_vente.pharmacie_id,p_montant,p_mode,nullif(trim(p_reference),''),auth.uid())
  returning id into v_paiement;

  update public.ventes
  set statut='payee', mode_paiement=p_mode,
      paiement_ref=nullif(trim(p_reference),''), paid_at=now()
  where id=v_vente.id;

  return v_paiement;
end;
$naxa$;

revoke all on function public.vente_ajouter_paiement(uuid,integer,public.mode_paiement_caisse,text)
  from public,anon,authenticated;
grant execute on function public.vente_ajouter_paiement(uuid,integer,public.mode_paiement_caisse,text)
  to authenticated;

create or replace function public.client_credit_enregistrer_vente(
  p_vente uuid,
  p_montant integer,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $naxa$
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
  if v_new_solde > v_credit.plafond and not exists (
    select 1 from public.client_credit_requests q
    where q.vente_id=v_vente.id and q.statut='approuvee' and q.consumed_at is null
  ) then
    raise exception 'Plafond de crédit dépassé : demande Promoteur requise';
  end if;

  perform public.vente_ajouter_paiement(
    v_vente.id,p_montant,'credit'::public.mode_paiement_caisse,p_reference
  );

  update public.client_credits
    set solde=v_new_solde, updated_at=now()
  where id=v_credit.id;

  update public.client_credit_requests
    set consumed_at=now()
  where vente_id=v_vente.id and statut='approuvee' and consumed_at is null;

  insert into public.client_credit_operations(
    credit_id,pharmacie_id,client_id,vente_id,nature,montant,reference,created_by
  ) values(
    v_credit.id,v_vente.pharmacie_id,v_vente.client_id,v_vente.id,'credit',p_montant,
    nullif(trim(p_reference),''),auth.uid()
  ) returning id into v_op;

  return v_op;
end;
$naxa$;

revoke all on function public.client_credit_enregistrer_vente(uuid,integer,text)
  from public,anon,authenticated;
grant execute on function public.client_credit_enregistrer_vente(uuid,integer,text)
  to authenticated;
