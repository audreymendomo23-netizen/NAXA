-- NAXA 163 — un statut « payé » exige une preuve POS liée et encaissée.
-- Bloque les anciennes RPC qui pouvaient marquer une réservation/commande payée
-- sans transaction de caisse ni ligne de paiement.
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
    when r.statut = 'en_attente' then p_statut in ('confirmee', 'annulee', 'expiree')
    when r.statut = 'confirmee' then p_statut in ('annulee', 'expiree')
    when r.statut = 'payee' then p_statut = 'retiree'
    else false
  end;

  if p_statut = 'payee' then
    if not exists (
      select 1
      from public.ventes v
      join public.vente_paiements vp on vp.vente_id = v.id
      where v.reservation_id = r.id
        and v.pharmacie_id = r.pharmacie_id
        and v.statut = 'payee'
        and v.total_net = r.total
        and vp.montant = r.total
    ) then
      raise exception 'Paiement refusé : aucun ticket POS payé correspondant à cette réservation';
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

revoke all on function private.set_reservation_status(uuid, public.resa_statut) from public, anon, authenticated;

create or replace function public.set_reservation_status(
  p_id uuid,
  p_statut public.resa_statut
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_r public.reservations;
  v_user uuid := auth.uid();
begin
  select * into v_r
  from public.reservations
  where id = p_id
  for update;

  if not found then
    raise exception 'Réservation introuvable';
  end if;

  if v_r.mode = 'commande'
     and p_statut = 'annulee'
     and v_r.client_id = v_user
     and v_r.commande_statut not in ('en_attente_pharmacie', 'acceptee') then
    raise exception 'Cette commande ne peut plus être annulée depuis NAXA. Contactez la pharmacie.';
  end if;

  perform private.set_reservation_status(p_id, p_statut);

  if p_statut in ('payee', 'retiree') then
    update public.reservations
    set paiement_statut = 'effectue'
    where id = p_id;
  end if;

  if p_statut in ('annulee', 'expiree') and v_r.mode = 'commande' then
    update public.reservations
    set commande_statut = 'annulee'
    where id = p_id;
  end if;
end;
$function$;

revoke all on function public.set_reservation_status(uuid, public.resa_statut) from public, anon;
grant execute on function public.set_reservation_status(uuid, public.resa_statut) to authenticated;

create or replace function public.mettre_a_jour_commande_client(
  p_id uuid,
  p_statut text,
  p_paiement_confirme boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_r public.reservations;
  v_allowed boolean := false;
begin
  if v_user is null then
    raise exception 'Connexion requise';
  end if;

  select * into v_r
  from public.reservations
  where id = p_id
  for update;

  if not found or v_r.mode <> 'commande' then
    raise exception 'Commande introuvable';
  end if;

  if not (
    public.is_admin()
    or public.naxa_scope_allows(v_user, v_r.pharmacie_id, 'PHARMACIE')
  ) then
    raise exception 'Action non autorisée';
  end if;

  if p_paiement_confirme then
    if not exists (
      select 1
      from public.ventes v
      join public.vente_paiements vp on vp.vente_id = v.id
      where v.reservation_id = v_r.id
        and v.pharmacie_id = v_r.pharmacie_id
        and v.statut = 'payee'
        and v.total_net = v_r.total
        and vp.montant = v_r.total
    ) then
      raise exception 'Paiement non confirmé : encaissez la commande via une transaction POS liée avant de confirmer son paiement';
    end if;
  end if;

  v_allowed := case
    when v_r.commande_statut = 'en_attente_pharmacie' then p_statut in ('acceptee', 'annulee')
    when v_r.commande_statut = 'acceptee' then p_statut in ('preparation', 'annulee')
    when v_r.commande_statut = 'preparation' then p_statut in ('livreur_assigne', 'en_livraison', 'annulee')
    when v_r.commande_statut = 'livreur_assigne' then p_statut in ('en_livraison', 'annulee')
    when v_r.commande_statut = 'en_livraison' then p_statut = 'livree'
    else false
  end;

  if not v_allowed and p_statut is distinct from v_r.commande_statut then
    raise exception 'Transition de commande interdite';
  end if;

  if p_statut = 'annulee' and v_r.statut not in ('annulee', 'expiree', 'retiree') then
    perform private.set_reservation_status(p_id, 'annulee'::public.resa_statut);
  end if;

  if p_paiement_confirme and v_r.statut not in ('payee', 'retiree') then
    perform private.set_reservation_status(p_id, 'payee'::public.resa_statut);
  end if;

  update public.reservations
  set commande_statut = p_statut,
      expires_at = case
        when p_statut in ('acceptee', 'preparation', 'livreur_assigne', 'en_livraison', 'livree')
          and not p_paiement_confirme
          and v_r.paiement_statut <> 'effectue'
        then now() + interval '100 years'
        else expires_at
      end
  where id = p_id;

  return true;
end;
$function$;

revoke all on function public.mettre_a_jour_commande_client(uuid, text, boolean) from public, anon;
grant execute on function public.mettre_a_jour_commande_client(uuid, text, boolean) to authenticated;

comment on function private.set_reservation_status(uuid, public.resa_statut) is
  'Les transitions vers payee exigent un ticket POS payé et un paiement correspondant à la réservation; aucun simple changement de statut ne peut confirmer un paiement.';

commit;
