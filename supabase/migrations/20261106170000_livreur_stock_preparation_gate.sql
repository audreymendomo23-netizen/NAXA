-- NAXA — preuve physique du travail Stock obligatoire avant publication d'une mission Livreur.
begin;

create or replace function public.gestionnaire_stock_commande_preparation(
  p_reservation uuid,
  p_etat text
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_r public.reservations%rowtype;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if p_etat not in ('en_preparation','prete_au_retrait') then
    raise exception 'État de préparation invalide';
  end if;
  select * into v_r from public.reservations where id=p_reservation for update;
  if not found or v_r.mode<>'commande' then raise exception 'Commande Marketplace introuvable'; end if;
  if v_r.commande_statut<>'preparation' or v_r.statut in ('annulee','expiree','retiree') then
    raise exception 'La commande doit être acceptée et en préparation par la pharmacie';
  end if;
  if not public.naxa_scope_allows(v_uid,v_r.pharmacie_id,'PHARMACIE') then
    raise exception 'Commande hors périmètre pharmacie';
  end if;

  v_role:=public.naxa_business_function(v_uid);
  if not public.is_admin() and v_role not in ('gestionnaire_stock','magasinier') then
    raise exception 'Action réservée au Gestionnaire de stock ou Magasinier';
  end if;
  if v_r.preparation_statut='annulee' then raise exception 'Préparation annulée'; end if;

  if p_etat='en_preparation' then
    if v_r.preparation_statut='prete_au_retrait' then
      raise exception 'La commande est déjà déclarée prête';
    end if;
    update public.reservations
    set preparation_statut='en_preparation',
        preparation_demarre_le=coalesce(preparation_demarre_le,now())
    where id=p_reservation;
  else
    if v_r.preparation_statut='prete_au_retrait' then return true; end if;
    if v_r.preparation_statut is distinct from 'en_preparation' then
      raise exception 'Démarrez la préparation avant de confirmer que la commande est prête';
    end if;
    update public.reservations
    set preparation_statut='prete_au_retrait',
        prete_au_retrait_le=now()
    where id=p_reservation;
  end if;
  return true;
end;
$function$;
revoke all on function public.gestionnaire_stock_commande_preparation(uuid,text) from public,anon;
grant execute on function public.gestionnaire_stock_commande_preparation(uuid,text) to authenticated;

create or replace function public.naxa_delivery_make_available(p_reservation uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_r public.reservations%rowtype;
  v_m public.naxa_delivery_missions%rowtype;
  v_mission uuid;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select * into v_r from public.reservations where id=p_reservation for update;
  if not found or v_r.mode<>'commande' then raise exception 'Commande de livraison introuvable'; end if;
  if not public.naxa_scope_allows(v_uid,v_r.pharmacie_id,'PHARMACIE') then
    raise exception 'Commande hors périmètre pharmacie';
  end if;
  v_role:=public.naxa_business_function(v_uid);
  if not public.is_admin() and v_role not in ('gestionnaire_stock','magasinier') then
    raise exception 'Seul le poste Gestionnaire de stock ou Magasinier peut publier une livraison prête';
  end if;
  if v_r.commande_statut<>'preparation'
    or v_r.preparation_statut<>'prete_au_retrait'
    or v_r.statut in ('annulee','expiree','retiree') then
    raise exception 'Stock doit avoir enregistré la préparation puis confirmé Prête pour livraison';
  end if;

  select * into v_m from public.naxa_delivery_missions where reservation_id=p_reservation for update;
  if found then
    if v_m.statut='cancelled' then raise exception 'Cette commande a été annulée et ne peut plus être republiée'; end if;
    if v_m.statut='failed' then raise exception 'Cette mission doit être réaffectée par la pharmacie avant une nouvelle publication'; end if;
    return v_m.id;
  end if;

  insert into public.naxa_delivery_missions(reservation_id,pharmacie_id,client_id,ready_by)
  values(v_r.id,v_r.pharmacie_id,v_r.client_id,v_uid)
  returning id into v_mission;

  insert into public.naxa_delivery_events(
    mission_id,reservation_id,pharmacie_id,actor_id,event_type,label
  ) values(v_mission,v_r.id,v_r.pharmacie_id,v_uid,'ready','Préparation Stock terminée · commande publiée pour livraison');

  insert into public.naxa_delivery_mission_offers(mission_id,reservation_id,pharmacie_id,livreur_id)
  select v_mission,v_r.id,v_r.pharmacie_id,a.profile_id
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id and p.actif=true
  where a.pharmacie_id=v_r.pharmacie_id and a.role_code='livreur' and a.statut='active'
    and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now());

  insert into public.notifications(user_id,pharmacie_id,type,titre,corps,reservation_id,related_entity_id)
  select distinct a.profile_id,v_r.pharmacie_id,'delivery_mission','Nouvelle livraison disponible',
    'Une commande préparée attend un livreur dans votre pharmacie.',v_r.id,v_mission
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id and p.actif=true
  where a.pharmacie_id=v_r.pharmacie_id and a.role_code='livreur' and a.statut='active'
    and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now());

  return v_mission;
end;
$function$;
revoke all on function public.naxa_delivery_make_available(uuid) from public,anon;
grant execute on function public.naxa_delivery_make_available(uuid) to authenticated;

commit;
