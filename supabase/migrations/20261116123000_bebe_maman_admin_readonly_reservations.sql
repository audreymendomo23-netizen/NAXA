-- NAXA — La supervision Admin B&M est en lecture seule dans les deux moteurs de réservation.
begin;

CREATE OR REPLACE FUNCTION public.transition_universe_reservation(p_reservation_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  uid uuid := auth.uid();
  r public.universe_reservations%rowtype;
  it record;
  is_admin boolean;
  can_manage boolean;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select * into r from public.universe_reservations where id=p_reservation_id for update;
  if not found then raise exception 'Réservation introuvable'; end if;
  select exists(select 1 from public.profiles p where p.id=uid and p.role='admin') into is_admin;
  select exists(select 1 from public.partner_members pm where pm.partner_id=r.partner_id and pm.user_id=uid and pm.member_role in ('owner','manager','operator')) into can_manage;

  if r.universe_slug='bebe-maman' and is_admin then
    raise exception 'La supervision Admin Bébé & Maman est en lecture seule';
  end if;

  if p_status='cancelled' and r.client_id=uid and r.status in ('requested','confirmed') then
    if r.payment_mode in ('orange_money','mtn_momo') then
      if r.payment_status<>'awaiting_payment' then
        raise exception 'Le SMS payeur a déjà été soumis ou le paiement est rapproché ; annulation directe refusée. Contactez le partenaire pour traiter le dossier.';
      end if;
      if exists (
        select 1 from public.naxa_universe_payment_intents i
        where i.reservation_id=r.id and i.status in ('submitted','matched')
      ) then
        raise exception 'Un SMS payeur a déjà été soumis ; annulation directe refusée.';
      end if;
      update public.naxa_universe_payment_intents
      set status='cancelled',updated_at=now()
      where reservation_id=r.id and status='active';
      update public.universe_reservations
      set status='cancelled',payment_mode=null,payment_status='not_required',updated_at=now()
      where id=r.id;
    else
      update public.universe_reservations set status='cancelled',updated_at=now() where id=r.id;
    end if;
    return;
  end if;
  if not (is_admin or can_manage) then raise exception 'Action non autorisée'; end if;
  if r.status in ('picked_up','cancelled','expired') then raise exception 'Réservation déjà clôturée'; end if;
  if p_status='confirmed' and r.status='requested' then
    update public.universe_reservations set status='confirmed',updated_at=now() where id=r.id;
  elsif p_status='ready' and r.status in ('requested','confirmed') then
    update public.universe_reservations set status='ready',updated_at=now() where id=r.id;
  elsif p_status='picked_up' and r.status='ready' then
    if r.payment_mode in ('orange_money','mtn_momo') and r.payment_status<>'confirmed' then
      raise exception 'Le paiement électronique doit être rapproché par les deux SMS avant le retrait';
    end if;
    for it in select ri.product_id,ri.quantity,pp.stock_quantity
      from public.universe_reservation_items ri
      join public.partner_products pp on pp.id=ri.product_id
      where ri.reservation_id=r.id
      order by ri.product_id
      for update of pp
    loop
      if it.stock_quantity < it.quantity then raise exception 'Stock physique insuffisant lors du retrait'; end if;
      update public.partner_products set stock_quantity=stock_quantity-it.quantity,updated_at=now() where id=it.product_id;
      insert into public.stock_movements(partner_id,product_id,quantity_delta,movement_type,reason,reference,created_by)
      values(r.partner_id,it.product_id,-it.quantity,'sale','Retrait confirmé',r.id::text,uid);
    end loop;
    update public.universe_reservations set status='picked_up',picked_up_at=now(),updated_at=now() where id=r.id;
  else
    raise exception 'Transition de statut non autorisée';
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.gestionnaire_stock_reservation_confirmer(p_reservation uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_user uuid:=auth.uid(); v_r public.reservations%rowtype; v_profile public.profiles%rowtype;
 v_item record; v_stock integer; v_has_lots boolean; v_allocated integer; v_invalid integer;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 select * into v_r from public.reservations where id=p_reservation for update;
 if not found or v_r.mode<>'reservation' then raise exception 'Réservation avec retrait introuvable'; end if;
 if not private.naxa_scope_allows(v_user,v_r.pharmacie_id,'PHARMACIE')
  and not public.naxa_has_active_professional_assignment(v_user,v_r.pharmacie_id,'gestionnaire_stock')
  and not public.naxa_has_active_professional_assignment(v_user,v_r.pharmacie_id,'magasinier') then raise exception 'Réservation hors périmètre pharmacie'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if found and v_profile.role='admin' and v_r.source_universe_slug='bebe-maman' then
  raise exception 'La supervision Admin Bébé & Maman est en lecture seule';
 end if;
 if not found or not (private.naxa_business_function(v_user) in ('admin','promoteur')
  or private.naxa_business_function(v_user) in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
  or public.naxa_has_privilege('MANAGE_LOTS',v_r.pharmacie_id,'PHARMACIE')
  or public.naxa_has_active_professional_assignment(v_user,v_r.pharmacie_id,'gestionnaire_stock')
  or public.naxa_has_active_professional_assignment(v_user,v_r.pharmacie_id,'magasinier')) then raise exception 'Confirmation non autorisée pour ce compte'; end if;
 if v_r.statut<>'en_attente' then raise exception 'Seule une réservation en attente peut être confirmée'; end if;
 if v_r.expires_at<=now() then raise exception 'Réservation expirée : elle ne peut pas être confirmée'; end if;
 if not exists(select 1 from public.reservation_items ri where ri.reservation_id=v_r.id) then raise exception 'Réservation sans lignes'; end if;

 for v_item in
  select ri.produit_id,sum(ri.quantite)::integer as quantite
  from public.reservation_items ri where ri.reservation_id=v_r.id group by ri.produit_id
 loop
  select s.quantite into v_stock from public.stocks s
   where s.pharmacie_id=v_r.pharmacie_id and s.produit_id=v_item.produit_id for update;
  if not found or v_stock<0 then raise exception 'Stock agrégé absent ou incohérent pour le produit %',v_item.produit_id; end if;
  select exists(select 1 from public.stocks_lots sl where sl.pharmacie_id=v_r.pharmacie_id and sl.produit_id=v_item.produit_id)
   into v_has_lots;
  if v_has_lots then
   select
    coalesce(sum(a.quantite) filter(where a.restauree_at is null),0)::integer,
    coalesce(sum(a.quantite) filter(where a.restauree_at is null and (sl.bloque or sl.date_peremption is null or sl.date_peremption<private.naxa_date_cameroun())),0)::integer
   into v_allocated,v_invalid
   from public.reservation_item_lots a
   join public.stocks_lots sl on sl.id=a.lot_id
   where a.reservation_id=v_r.id and a.produit_id=v_item.produit_id;
   if v_allocated<>v_item.quantite then
    raise exception 'Allocation de lots absente ou incomplète pour le produit % : réservée %, allocation %',v_item.produit_id,v_item.quantite,v_allocated;
   end if;
   if v_invalid>0 then
    raise exception 'Un lot affecté à cette réservation est maintenant bloqué ou périmé pour le produit %; réaffectation manuelle requise',v_item.produit_id;
   end if;
  end if;
 end loop;
 perform public.set_reservation_status(p_reservation,'confirmee'::public.resa_statut);
 return true;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.gestionnaire_stock_reservation_annuler(p_reservation uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  if not private.naxa_scope_allows(v_user,v_r.pharmacie_id,'PHARMACIE') and not v_assigned then
    raise exception 'Réservation hors périmètre pharmacie';
  end if;
  select * into v_profile from public.profiles where id=v_user and actif=true;
  if found and v_profile.role='admin' and v_r.source_universe_slug='bebe-maman' then
    raise exception 'La supervision Admin Bébé & Maman est en lecture seule';
  end if;
  if not found or not (
    private.naxa_business_function(v_user) in ('admin','promoteur')
    or private.naxa_business_function(v_user) in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
    or public.naxa_has_privilege('MANAGE_LOTS',v_r.pharmacie_id,'PHARMACIE')
    or v_assigned
  ) then raise exception 'Annulation réservée à un rôle pharmacie autorisé'; end if;
  if v_r.statut not in ('en_attente','confirmee') then
    raise exception 'Seule une réservation active peut être annulée';
  end if;
  perform public.set_reservation_status(p_reservation,'annulee'::public.resa_statut);
  return true;
end;
$function$
;

commit;
