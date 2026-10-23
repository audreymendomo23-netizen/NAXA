-- NAXA 230 — rendre la préparation et la clôture d'inventaire compatibles
-- avec les affectations Stock actives, sans élargir le périmètre pharmacie.
begin;

create or replace function public.inventaire_preparer_ligne(
  p_inventaire uuid,
  p_produit uuid,
  p_lot uuid default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pharmacie uuid;
  v_q integer := 0;
  v_cout integer := 0;
  v_id uuid;
  v_assigned boolean;
begin
  select i.pharmacie_id into v_pharmacie
  from public.inventaires i
  where i.id = p_inventaire and i.statut in ('brouillon','en_cours');

  if v_pharmacie is null then raise exception 'Inventaire non autorisé'; end if;

  v_assigned := public.naxa_has_active_professional_assignment(auth.uid(),v_pharmacie,'gestionnaire_stock')
    or public.naxa_has_active_professional_assignment(auth.uid(),v_pharmacie,'magasinier');

  if not (public.is_admin() or public.can_access_pharmacy(v_pharmacie) or v_assigned) then
    raise exception 'Inventaire non autorisé';
  end if;

  if p_lot is null then
    select coalesce(s.quantite,0),coalesce(sc.cout_unitaire,0)
      into v_q,v_cout
    from public.stocks s
    left join public.stocks_couts sc
      on sc.pharmacie_id=s.pharmacie_id and sc.produit_id=s.produit_id
    where s.pharmacie_id=v_pharmacie and s.produit_id=p_produit;
  else
    select coalesce(sl.quantite,0),coalesce(sc.cout_unitaire,0)
      into v_q,v_cout
    from public.stocks_lots sl
    left join public.stocks_couts sc
      on sc.pharmacie_id=sl.pharmacie_id and sc.produit_id=sl.produit_id
    where sl.id=p_lot and sl.pharmacie_id=v_pharmacie and sl.produit_id=p_produit;
    if not found then raise exception 'Lot introuvable'; end if;
  end if;

  insert into public.inventaire_lignes(
    inventaire_id,produit_id,lot_id,quantite_theorique,cout_unitaire
  ) values (p_inventaire,p_produit,p_lot,v_q,v_cout)
  on conflict(inventaire_id,produit_id,lot_id)
  do update set quantite_theorique=excluded.quantite_theorique,
                cout_unitaire=excluded.cout_unitaire
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.inventaire_cloturer(p_inventaire uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pharmacie uuid;
  v_assigned boolean;
begin
  select i.pharmacie_id into v_pharmacie
  from public.inventaires i
  where i.id=p_inventaire and i.statut in ('brouillon','en_cours')
  for update;

  if v_pharmacie is null then raise exception 'Inventaire non autorisé'; end if;

  v_assigned := public.naxa_has_active_professional_assignment(auth.uid(),v_pharmacie,'gestionnaire_stock')
    or public.naxa_has_active_professional_assignment(auth.uid(),v_pharmacie,'magasinier');

  if not (public.is_admin() or public.can_access_pharmacy(v_pharmacie) or v_assigned) then
    raise exception 'Inventaire non autorisé';
  end if;

  if exists (
    select 1 from public.inventaire_lignes l
    where l.inventaire_id=p_inventaire and l.quantite_comptee is null
  ) then
    raise exception 'Toutes les lignes doivent être comptées avant clôture';
  end if;

  update public.inventaires
  set statut='cloture',closed_at=now(),closed_by=auth.uid(),updated_at=now()
  where id=p_inventaire;
end;
$function$;

revoke all on function public.inventaire_preparer_ligne(uuid,uuid,uuid) from public, anon;
grant execute on function public.inventaire_preparer_ligne(uuid,uuid,uuid) to authenticated;
revoke all on function public.inventaire_cloturer(uuid) from public, anon;
grant execute on function public.inventaire_cloturer(uuid) to authenticated;

commit;
