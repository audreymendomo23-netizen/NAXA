-- NAXA ERP-003 — POS étape 2 : paiements et finalisation
-- Extension additive du moteur POS existant.

create table if not exists public.vente_paiements (
  id uuid primary key default gen_random_uuid(),
  vente_id uuid not null references public.ventes(id) on delete cascade,
  mode public.mode_paiement_caisse not null,
  montant integer not null check (montant > 0),
  reference text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists vente_paiements_vente_idx
  on public.vente_paiements(vente_id);

alter table public.vente_paiements enable row level security;

drop policy if exists vente_paiements_scope on public.vente_paiements;
create policy vente_paiements_scope on public.vente_paiements
for select to authenticated
using (
  exists (
    select 1 from public.ventes v
    where v.id=vente_id
      and (public.is_admin() or public.can_access_pharmacy(v.pharmacie_id))
  )
);

revoke all on public.vente_paiements from anon, authenticated;
grant select on public.vente_paiements to authenticated;

create or replace function public.vente_ajouter_paiement(
  p_vente uuid,
  p_mode public.mode_paiement_caisse,
  p_montant integer,
  p_reference text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $paiement$
declare
  v_vente public.ventes%rowtype;
  v_id uuid;
  v_deja integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_montant is null or p_montant <= 0 then raise exception 'Montant de paiement invalide'; end if;

  select * into v_vente
  from public.ventes
  where id=p_vente
  for update;

  if not found then raise exception 'Vente introuvable'; end if;
  if v_vente.statut <> 'brouillon' then raise exception 'Vente déjà clôturée'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then
    raise exception 'Vente hors périmètre';
  end if;

  select coalesce(sum(montant),0) into v_deja
  from public.vente_paiements
  where vente_id=p_vente;

  if v_deja + p_montant > v_vente.total_net then
    raise exception 'Le paiement dépasse le total de la vente';
  end if;

  if p_mode = 'mobile_money' and nullif(trim(coalesce(p_reference,'')),'') is null then
    raise exception 'Référence Mobile Money obligatoire';
  end if;

  insert into public.vente_paiements(vente_id,mode,montant,reference,created_by)
  values(p_vente,p_mode,p_montant,nullif(trim(p_reference),''),auth.uid())
  returning id into v_id;

  return v_id;
end;
$paiement$;

create or replace function public.vente_finaliser(
  p_vente uuid
)
returns void
language plpgsql
security definer
set search_path=''
as $finalisation$
declare
  v_vente public.ventes%rowtype;
  v_paye integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;

  select * into v_vente
  from public.ventes
  where id=p_vente
  for update;

  if not found then raise exception 'Vente introuvable'; end if;
  if v_vente.statut <> 'brouillon' then raise exception 'Vente déjà clôturée'; end if;
  if not (public.is_admin() or public.can_operate_pharmacy(v_vente.pharmacie_id)) then
    raise exception 'Vente hors périmètre';
  end if;

  if not exists(select 1 from public.vente_lignes where vente_id=p_vente) then
    raise exception 'Vente vide';
  end if;

  select coalesce(sum(montant),0) into v_paye
  from public.vente_paiements
  where vente_id=p_vente;

  if v_paye <> v_vente.total_net then
    raise exception 'Paiement incomplet';
  end if;

  update public.ventes
  set statut='payee',
      mode_paiement=(
        select mode from public.vente_paiements
        where vente_id=p_vente
        group by mode
        order by sum(montant) desc, mode::text
        limit 1
      ),
      paiement_ref=(
        select string_agg(reference, ', ')
        from public.vente_paiements
        where vente_id=p_vente and reference is not null
      ),
      paid_at=now()
  where id=p_vente;
end;
$finalisation$;

revoke all on function public.vente_ajouter_paiement(uuid,public.mode_paiement_caisse,integer,text) from public,anon,authenticated;
revoke all on function public.vente_finaliser(uuid) from public,anon,authenticated;
grant execute on function public.vente_ajouter_paiement(uuid,public.mode_paiement_caisse,integer,text) to authenticated;
grant execute on function public.vente_finaliser(uuid) to authenticated;

comment on table public.vente_paiements is
  'Paiements POS détaillés ; plusieurs lignes permettent un paiement mixte sans créer de second moteur de vente.';
