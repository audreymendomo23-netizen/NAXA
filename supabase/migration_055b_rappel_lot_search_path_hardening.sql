-- NAXA ERP-011 — durcissement additif du search_path de lot_lever_rappel.
-- migration_055_rappel_lot.sql est conservée intacte.
-- Les objets et fonctions sont qualifiés explicitement sous search_path vide.
create or replace function public.lot_lever_rappel(p_lot uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_pharmacie uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Connexion requise'; end if;

  select pharmacie_id into v_pharmacie
  from public.stocks_lots
  where id=p_lot
  for update;

  if v_pharmacie is null then raise exception 'Lot introuvable'; end if;
  if not (public.is_admin() or public.can_access_pharmacy(v_pharmacie)) then
    raise exception 'Lot non autorisé';
  end if;

  update public.rappels_lots
  set statut='leve', leve_at=now(), leve_par=v_user
  where lot_id=p_lot and statut='actif';

  update public.stocks_lots
  set bloque=false, motif_blocage=null
  where id=p_lot;
end;
$$;

revoke all on function public.lot_lever_rappel(uuid)
  from public, anon, authenticated;
grant execute on function public.lot_lever_rappel(uuid) to authenticated;
