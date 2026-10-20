-- NAXA Marketplace: payment code + pharmacy-recorded payment, without payment-provider APIs.
create extension if not exists pgcrypto;

alter table public.reservations
  add column if not exists code_paiement text;

update public.reservations
set code_paiement = upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12))
where code_paiement is null;

alter table public.reservations
  alter column code_paiement set default upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));

alter table public.reservations
  alter column code_paiement set not null;

create unique index if not exists reservations_code_paiement_uidx
  on public.reservations(code_paiement);

create or replace function public.naxa_marketplace_payment_code_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.code_paiement is null or btrim(new.code_paiement) = '' then
    new.code_paiement := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_naxa_marketplace_payment_code_guard on public.reservations;
create trigger trg_naxa_marketplace_payment_code_guard
before insert on public.reservations
for each row execute function public.naxa_marketplace_payment_code_guard();

-- Disable the former cash-only path so all Marketplace receipts use the verified payment code and selected channel.
create or replace function public.vente_reservation_encaisser(
  p_reservation uuid,
  p_session uuid,
  p_montant_percu integer
)
returns table(vente_id uuid, numero_vente text, total integer, monnaie_rendue integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Parcours Marketplace mis à jour : utilisez le code de paiement et le canal déclaré.';
end;
$$;
revoke execute on function public.vente_reservation_encaisser(uuid, uuid, integer) from public, anon, authenticated;

create or replace function public.vente_reservation_encaisser(
  p_reservation uuid,
  p_session uuid,
  p_montant_percu integer,
  p_canal text,
  p_code_paiement text
)
returns table(vente_id uuid, numero_vente text, total integer, monnaie_rendue integer, canal text, code_paiement text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reservations%rowtype;
  v_session public.caisses_sessions%rowtype;
  v_vente uuid;
  v_numero text;
  v_monnaie integer := 0;
  v_canal public.mode_paiement_caisse;
  v_montant_enregistre integer;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  if p_reservation is null or p_session is null then raise exception 'Réservation et session de caisse requises'; end if;
  if p_code_paiement is null or length(btrim(p_code_paiement)) < 6 then raise exception 'Code de paiement requis'; end if;
  if p_montant_percu is null or p_montant_percu <= 0 then raise exception 'Montant perçu invalide'; end if;

  if p_canal not in ('especes','orange_money','mtn_momo','mobile_money','carte','autre') then
    raise exception 'Canal de paiement non pris en charge';
  end if;
  v_canal := p_canal::public.mode_paiement_caisse;

  select * into r
  from public.reservations
  where id = p_reservation
  for update;

  if not found then raise exception 'Réservation introuvable'; end if;
  if r.mode <> 'reservation' then raise exception 'Seules les réservations avec retrait en pharmacie sont encaissables ici'; end if;
  if upper(btrim(r.code_paiement)) <> upper(btrim(p_code_paiement)) then raise exception 'Code de paiement incorrect'; end if;
  if r.statut <> 'confirmee' then raise exception 'La réservation doit être confirmée par la pharmacie avant encaissement'; end if;
  if r.expires_at <= now() then raise exception 'Réservation expirée : aucun encaissement ne peut être effectué'; end if;
  if r.paiement_statut = 'effectue' then raise exception 'Cette réservation est déjà marquée comme payée'; end if;
  if not public.naxa_caisse_actor_for_pharmacy(r.pharmacie_id) then raise exception 'Encaissement réservé à un compte Caisse actif de cette pharmacie'; end if;

  select cs.* into v_session
  from public.caisses_sessions cs
  join public.caisses c on c.id = cs.caisse_id
  where cs.id = p_session and cs.statut = 'ouverte' and cs.ouvert_par = auth.uid()
    and c.actif = true and c.pharmacie_id = r.pharmacie_id
  for update of cs;
  if not found then raise exception 'Session ouverte introuvable, inactive ou hors pharmacie'; end if;

  if exists (select 1 from public.ventes v where v.reservation_id = r.id) then
    raise exception 'Une vente POS est déjà liée à cette réservation';
  end if;

  select coalesce(sum(ri.quantite * ri.prix_unitaire), 0)::integer
    into v_montant_enregistre
  from public.reservation_items ri where ri.reservation_id = r.id;
  if not exists (select 1 from public.reservation_items ri where ri.reservation_id = r.id) then
    raise exception 'Réservation sans articles : encaissement refusé';
  end if;
  if v_montant_enregistre <> r.total then raise exception 'Le total des articles ne correspond pas au total de la réservation'; end if;

  if p_canal = 'especes' then
    if p_montant_percu < r.total then raise exception 'Montant espèces insuffisant'; end if;
    v_monnaie := p_montant_percu - r.total;
  else
    if p_montant_percu <> r.total then raise exception 'Pour ce canal, le montant constaté doit être exactement égal au total du reçu'; end if;
  end if;

  insert into public.ventes(pharmacie_id,caisse_session_id,client_id,statut,remise,total_brut,total_net,created_by,reservation_id)
  values(r.pharmacie_id,p_session,r.client_id,'brouillon',0,r.total,r.total,auth.uid(),r.id)
  returning id into v_vente;

  -- Reservation already holds stock; copying lines must not debit stock again.
  insert into public.vente_lignes(vente_id,produit_id,quantite,prix_unitaire)
  select v_vente,ri.produit_id,ri.quantite,ri.prix_unitaire
  from public.reservation_items ri where ri.reservation_id = r.id order by ri.produit_id;

  insert into public.vente_paiements(vente_id,mode,montant,reference,created_by,montant_percu,monnaie_rendue)
  values(v_vente,v_canal,r.total,'Marketplace NAXA · ' || upper(r.code_paiement),auth.uid(),p_montant_percu,v_monnaie);

  update public.ventes
  set statut='payee',mode_paiement=v_canal,paiement_ref='Marketplace NAXA · ' || upper(r.code_paiement),paid_at=now()
  where id=v_vente and statut='brouillon';
  if not found then raise exception 'La vente a changé de statut pendant l’encaissement'; end if;

  update public.reservations
  set paiement_mode=case when p_canal='especes' then 'especes_retrait' else p_canal end,
      paiement_ref='Marketplace NAXA · ' || upper(r.code_paiement)
  where id=r.id;

  perform public.set_reservation_status(r.id,'payee'::public.resa_statut);

  select v.numero_vente into v_numero from public.ventes v where v.id=v_vente;
  return query select v_vente,v_numero,r.total,v_monnaie,p_canal,upper(r.code_paiement);
end;
$$;

revoke execute on function public.vente_reservation_encaisser(uuid,uuid,integer,text,text) from public, anon;
grant execute on function public.vente_reservation_encaisser(uuid,uuid,integer,text,text) to authenticated;

comment on column public.reservations.code_paiement is 'Code Marketplace NAXA unique, utilisable pour retrouver la facture au retrait; aucune API de paiement.';
