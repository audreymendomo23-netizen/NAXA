-- NAXA 160 — transitions strictes des réservations Pharmacie.
-- La migration 097 avait remplacé la validation historique par une simple
-- interdiction des statuts terminaux. Cette version restaure les transitions
-- métier et interdit de confirmer un retrait avant le paiement.
begin;

create or replace function private.set_reservation_status(
  p_id uuid,
  p_statut public.resa_statut
)
returns void
language plpgsql
security definer
set search_path = 'public'
as $function$
declare
  r public.reservations;
  uid uuid := auth.uid();
  transition_ok boolean;
begin
  if uid is null then
    raise exception 'Connexion requise';
  end if;

  select * into r
  from public.reservations
  where id = p_id
  for update;

  if not found then
    raise exception 'Réservation introuvable';
  end if;

  if not (
    public.is_admin()
    or private.naxa_scope_allows(uid, r.pharmacie_id, 'PHARMACIE')
    or (r.client_id = uid and p_statut = 'annulee')
  ) then
    raise exception 'Action non autorisée';
  end if;

  transition_ok := case
    when r.statut = 'en_attente' then p_statut in ('confirmee', 'payee', 'annulee', 'expiree')
    when r.statut = 'confirmee' then p_statut in ('payee', 'annulee', 'expiree')
    when r.statut = 'payee' then p_statut = 'retiree'
    else false
  end;

  if not transition_ok then
    raise exception 'Transition de réservation interdite: % -> %', r.statut, p_statut;
  end if;

  if p_statut in ('annulee', 'expiree') then
    perform public.restore_stock(p_id);
  end if;

  update public.reservations
  set statut = p_statut
  where id = p_id;
end;
$function$;

revoke all on function private.set_reservation_status(uuid, public.resa_statut) from public, anon, authenticated;

comment on function private.set_reservation_status(uuid, public.resa_statut) is
  'Transition sécurisée des réservations Pharmacie : paiement avant retrait, contrôle du périmètre et restitution de stock pour annulation/expiration.';

commit;
