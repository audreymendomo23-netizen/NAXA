-- NAXA ERP-011 / F64 — a recall cannot be closed while recalled stock remains untreated.
create or replace function public.lot_lever_rappel(p_lot uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_pharmacie uuid; v_user uuid:=auth.uid(); v_profile public.profiles%rowtype; v_rappel public.rappels_lots%rowtype; v_lot public.stocks_lots%rowtype;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or coalesce(v_profile.role::text,'')<>'promoteur' then raise exception 'Seul le Promoteur actif peut clôturer un rappel de lot'; end if;
 select * into v_lot from public.stocks_lots where id=p_lot for update;
 if not found then raise exception 'Lot introuvable'; end if;
 v_pharmacie:=v_lot.pharmacie_id;
 if not public.can_access_pharmacy(v_pharmacie) then raise exception 'Lot hors périmètre du Promoteur'; end if;
 select * into v_rappel from public.rappels_lots where lot_id=p_lot and statut='actif' for update;
 if not found then raise exception 'Aucun rappel actif pour ce lot'; end if;
 if v_lot.quantite>0 then raise exception 'Clôture impossible : % unité(s) restent dans le lot. Enregistrez leur retour ou leur destruction.',v_lot.quantite; end if;
 update public.rappels_lots set statut='leve',leve_at=now(),leve_par=v_user where id=v_rappel.id and statut='actif';
 update public.stocks_lots set bloque=v_rappel.lot_bloque_avant,motif_blocage=v_rappel.lot_motif_blocage_avant
 where id=p_lot and bloque=true and motif_blocage=v_rappel.motif;
end; $$;
revoke all on function public.lot_lever_rappel(uuid) from public,anon,authenticated;
grant execute on function public.lot_lever_rappel(uuid) to authenticated;
