-- Les réservations encaissées par le POS peuvent être réglées en plusieurs lignes.
-- Pour Assurance : paiement Client + créance assureur = montant brut de la vente.
-- Le garde doit contrôler la somme de toutes les lignes, et non exiger une ligne unique égale au brut.
create or replace function private.set_reservation_status(
  p_id uuid,
  p_statut public.resa_statut
)
returns void
language plpgsql
security definer
set search_path to 'public'
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
    when r.statut = 'en_attente' then p_statut in ('confirmee', 'annulee', 'expiree')
    when r.statut = 'confirmee' then p_statut in ('annulee', 'expiree')
    when r.statut = 'payee' then p_statut = 'retiree'
    else false
  end;

  if p_statut = 'payee' then
    if not exists (
      select 1
      from public.ventes v
      where v.reservation_id = r.id
        and v.pharmacie_id = r.pharmacie_id
        and v.statut = 'payee'
        and v.total_net = r.total
        and exists (
          select 1 from public.vente_paiements vp
          where vp.vente_id = v.id
        )
        and (
          select coalesce(sum(vp.montant), 0)
          from public.vente_paiements vp
          where vp.vente_id = v.id
        ) = v.total_net
    ) then
      raise exception 'Paiement refusé : le total des règlements POS ne correspond pas au montant brut de la réservation';
    end if;
    transition_ok := r.statut = 'confirmee';
  end if;

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

comment on function private.set_reservation_status(uuid,public.resa_statut) is
  'Contrôle la transition de réservation et vérifie que la somme des lignes POS, y compris le tiers payant Assurance, égale le brut de la vente.';
