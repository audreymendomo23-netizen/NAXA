-- NAXA 237 — confirmation de réservation autorisée via affectation Stock active.
-- Les contrôles de statut, expiration et allocation atomique des lots restent inchangés.
begin;
create or replace function public.gestionnaire_stock_reservation_confirmer(p_reservation uuid)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare
 v_user uuid:=auth.uid(); v_r public.reservations%rowtype; v_profile public.profiles%rowtype;
 v_item record; v_stock integer; v_has_lots boolean; v_allocated integer; v_invalid integer;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 select * into v_r from public.reservations where id=p_reservation for update;
 if not found or v_r.mode<>'reservation' then raise exception 'Réservation avec retrait introuvable'; end if;
 if not public.naxa_scope_allows(v_user,v_r.pharmacie_id,'PHARMACIE')
  and not public.naxa_has_active_professional_assignment(v_user,v_r.pharmacie_id,'gestionnaire_stock')
  and not public.naxa_has_active_professional_assignment(v_user,v_r.pharmacie_id,'magasinier') then raise exception 'Réservation hors périmètre pharmacie'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur')
  or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
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
    coalesce(sum(a.quantite) filter(where a.restauree_at is null and (sl.bloque or sl.date_peremption is null or sl.date_peremption<current_date)),0)::integer
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
$function$;
revoke all on function public.gestionnaire_stock_reservation_confirmer(uuid) from public,anon,authenticated;
grant execute on function public.gestionnaire_stock_reservation_confirmer(uuid) to authenticated;
commit;
