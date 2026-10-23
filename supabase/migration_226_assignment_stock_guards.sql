-- NAXA 226 — reconnaître une affectation Stock active dans deux RPC métier.
-- Les autres opérations Stock restent soumises à leurs gardes historiques tant
-- qu'elles n'ont pas été raccordées explicitement à la table d'affectations.
begin;

create or replace function public.stock_service_open(p_pharmacie uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_role text;
  v_fonction text;
  v_assigned boolean;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select lower(coalesce(p.role,'')),lower(coalesce(p.fonction_interne,''))
    into v_role,v_fonction
  from public.profiles p where p.id=auth.uid() and p.actif is distinct from false;
  if not found then raise exception 'Profil actif requis'; end if;

  v_assigned := public.naxa_has_active_professional_assignment(auth.uid(),p_pharmacie,'gestionnaire_stock')
    or public.naxa_has_active_professional_assignment(auth.uid(),p_pharmacie,'magasinier');

  if not (
    v_role='admin'
    or v_role='promoteur'
    or v_fonction in ('gestionnaire_stock','magasinier')
    or v_assigned
  ) then
    raise exception 'Prise de service réservée au poste Stock autorisé';
  end if;
  if not (
    v_role='admin'
    or private.naxa_scope_allows(auth.uid(),p_pharmacie,'PHARMACIE')
    or v_assigned
  ) then
    raise exception 'Accès refusé à cette pharmacie';
  end if;

  insert into public.stock_service_sessions(pharmacie_id,gestionnaire_id,opening_note)
  values(p_pharmacie,auth.uid(),left(nullif(trim(p_note),''),500))
  returning id into v_id;

  insert into public.stock_service_inventory_counts(session_id,phase,produit_id,expected_quantity)
  select v_id,'opening',s.produit_id,greatest(s.quantite,0)
  from public.stocks s where s.pharmacie_id=p_pharmacie;

  return v_id;
exception when unique_violation then
  raise exception 'Une prise de service est déjà ouverte pour ce gestionnaire dans cette pharmacie';
end;
$function$;

create or replace function public.gestionnaire_stock_reservation_annuler(p_reservation uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_r public.reservations%rowtype;
  v_profile public.profiles%rowtype;
  v_assigned boolean;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  select * into v_r from public.reservations where id=p_reservation for update;
  if not found or v_r.mode <> 'reservation' then raise exception 'Réservation avec retrait introuvable'; end if;

  v_assigned := public.naxa_has_active_professional_assignment(v_user,v_r.pharmacie_id,'gestionnaire_stock')
    or public.naxa_has_active_professional_assignment(v_user,v_r.pharmacie_id,'magasinier');

  if not public.naxa_scope_allows(v_user,v_r.pharmacie_id,'PHARMACIE') and not v_assigned then
    raise exception 'Réservation hors périmètre pharmacie';
  end if;
  select * into v_profile from public.profiles where id=v_user and actif=true;
  if not found or not (
    coalesce(v_profile.role::text,'') in ('admin','promoteur')
    or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
    or public.naxa_has_privilege('MANAGE_LOTS',v_r.pharmacie_id,'PHARMACIE')
    or v_assigned
  ) then raise exception 'Annulation réservée à un rôle pharmacie autorisé'; end if;
  if v_r.statut not in ('en_attente','confirmee') then
    raise exception 'Seule une réservation active peut être annulée';
  end if;
  perform public.set_reservation_status(p_reservation,'annulee'::public.resa_statut);
  return true;
end;
$function$;

revoke all on function public.stock_service_open(uuid,text) from public,anon;
grant execute on function public.stock_service_open(uuid,text) to authenticated;
revoke all on function public.gestionnaire_stock_reservation_annuler(uuid) from public,anon;
grant execute on function public.gestionnaire_stock_reservation_annuler(uuid) to authenticated;

commit;
