-- NAXA 195 — confirmation serveur d’une réservation après contrôle des stocks/lots.
begin;
create or replace function public.gestionnaire_stock_reservation_confirmer(p_reservation uuid)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare
 v_user uuid:=auth.uid(); v_r public.reservations%rowtype; v_profile public.profiles%rowtype; v_item record;
 v_stock integer; v_has_lots boolean; v_utilisable integer; v_demande integer;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 select * into v_r from public.reservations where id=p_reservation for update;
 if not found or v_r.mode<>'reservation' then raise exception 'Réservation avec retrait introuvable'; end if;
 if not public.can_access_pharmacy(v_r.pharmacie_id) then raise exception 'Réservation hors périmètre pharmacie'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text) in ('admin','promoteur')
   or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
   or public.naxa_has_privilege('MANAGE_LOTS',v_r.pharmacie_id,'PHARMACIE')) then
  raise exception 'Confirmation non autorisée pour ce compte';
 end if;
 if v_r.statut<>'en_attente' then raise exception 'Seule une réservation en attente peut être confirmée'; end if;
 if v_r.expires_at<=now() then raise exception 'Réservation expirée : elle ne peut pas être confirmée'; end if;
 if not exists(select 1 from public.reservation_items ri where ri.reservation_id=v_r.id) then raise exception 'Réservation sans lignes'; end if;

 for v_item in
  select ri.produit_id,sum(ri.quantite)::integer as quantite
  from public.reservation_items ri where ri.reservation_id=v_r.id group by ri.produit_id
 loop
  select s.quantite into v_stock from public.stocks s
   where s.pharmacie_id=v_r.pharmacie_id and s.produit_id=v_item.produit_id;
  if not found then raise exception 'Produit absent du stock pharmacie : %',v_item.produit_id; end if;
  select exists(select 1 from public.stocks_lots sl where sl.pharmacie_id=v_r.pharmacie_id and sl.produit_id=v_item.produit_id)
   into v_has_lots;
  if v_has_lots then
   select coalesce(sum(sl.quantite) filter(where sl.date_peremption>=current_date and not sl.bloque),0)::integer
    into v_utilisable from public.stocks_lots sl
    where sl.pharmacie_id=v_r.pharmacie_id and sl.produit_id=v_item.produit_id;
   select coalesce(sum(ri.quantite),0)::integer into v_demande
    from public.reservation_items ri
    join public.reservations r on r.id=ri.reservation_id
    where r.pharmacie_id=v_r.pharmacie_id and r.mode='reservation'
      and r.statut in ('en_attente','confirmee') and r.expires_at>now()
      and ri.produit_id=v_item.produit_id;
   if v_utilisable<v_demande then
    raise exception 'Lots non périmés et non bloqués insuffisants pour couvrir les réservations actives du produit % (lots utilisables %, demande réservée %)',v_item.produit_id,v_utilisable,v_demande;
   end if;
  elsif v_stock<0 then
   raise exception 'Stock agrégé incohérent pour le produit %',v_item.produit_id;
  end if;
 end loop;
 perform public.set_reservation_status(p_reservation,'confirmee'::public.resa_statut);
 return true;
end;
$function$;
revoke all on function public.gestionnaire_stock_reservation_confirmer(uuid) from public,anon;
grant execute on function public.gestionnaire_stock_reservation_confirmer(uuid) to authenticated;
comment on function public.gestionnaire_stock_reservation_confirmer(uuid) is
 'Confirme uniquement une réservation active et autorisée; contrôle que les lots utilisables couvrent la demande réservée totale avant transition.';
commit;
