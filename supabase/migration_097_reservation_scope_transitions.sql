-- NAXA 097 — respecter le périmètre multi-pharmacie dans les transitions de transaction.
create or replace function private.set_reservation_status(p_id uuid,p_statut public.resa_statut)
returns void language plpgsql security definer set search_path='public'
as $function$
declare r public.reservations;
begin
  select * into r from public.reservations where id=p_id for update;
  if not found then raise exception 'Réservation introuvable'; end if;
  if not (private.is_admin() or private.naxa_scope_allows((select auth.uid()),r.pharmacie_id,'PHARMACIE') or (r.client_id=(select auth.uid()) and p_statut='annulee')) then raise exception 'Action non autorisée'; end if;
  if r.statut in ('retiree','expiree','annulee') then raise exception 'Réservation déjà clôturée'; end if;
  if p_statut in ('annulee','expiree') then perform public.restore_stock(p_id); end if;
  update public.reservations set statut=p_statut where id=p_id;
end;
$function$;
revoke all on function private.set_reservation_status(uuid,public.resa_statut) from public,anon,authenticated;