-- NAXA 203 — annulation de réservation réservée au poste stock/pharmacie autorisé.
begin;
create or replace function public.gestionnaire_stock_reservation_annuler(p_reservation uuid)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_r public.reservations%rowtype; v_profile public.profiles%rowtype;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 select * into v_r from public.reservations where id=p_reservation for update;
 if not found or v_r.mode<>'reservation' then raise exception 'Réservation avec retrait introuvable'; end if;
 if not public.naxa_scope_allows(v_user,v_r.pharmacie_id,'PHARMACIE') then raise exception 'Réservation hors périmètre pharmacie'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur')
  or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
  or public.naxa_has_privilege('MANAGE_LOTS',v_r.pharmacie_id,'PHARMACIE')) then raise exception 'Annulation réservée à un rôle pharmacie autorisé'; end if;
 if v_r.statut not in ('en_attente','confirmee') then raise exception 'Seule une réservation active peut être annulée'; end if;
 perform public.set_reservation_status(p_reservation,'annulee'::public.resa_statut);
 return true;
end;
$function$;
revoke all on function public.gestionnaire_stock_reservation_annuler(uuid) from public,anon;
grant execute on function public.gestionnaire_stock_reservation_annuler(uuid) to authenticated;
comment on function public.gestionnaire_stock_reservation_annuler(uuid) is
 'Annule un dossier de retrait uniquement pour un acteur pharmacie autorisé; la restitution est déléguée à la transition métier atomique.';
commit;
