-- NAXA 199 — blocage/déblocage contrôlé d’un lot.
begin;
create or replace function public.stock_lot_blocage_modifier(p_lot uuid,p_bloque boolean,p_motif text default null)
returns boolean language plpgsql security definer set search_path=''
as $f$
declare v_user uuid:=auth.uid(); v_pharmacie uuid; v_profile public.profiles%rowtype; v_motif text;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 if p_bloque is null then raise exception 'État de blocage requis'; end if;
 v_motif:=nullif(trim(coalesce(p_motif,'')),'');
 if p_bloque and (v_motif is null or char_length(v_motif)>500) then raise exception 'Un motif de blocage de 1 à 500 caractères est requis'; end if;
 select pharmacie_id into v_pharmacie from public.stocks_lots where id=p_lot for update;
 if v_pharmacie is null or not public.can_access_pharmacy(v_pharmacie) then raise exception 'Lot hors périmètre ou introuvable'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur')
   or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
   or public.naxa_has_privilege('MANAGE_LOTS',v_pharmacie,'PHARMACIE')) then raise exception 'Gestion des lots non autorisée'; end if;
 update public.stocks_lots set bloque=p_bloque,motif_blocage=case when p_bloque then v_motif else null end,updated_at=now()
 where id=p_lot and pharmacie_id=v_pharmacie;
 return found;
end;
$f$;
revoke all on function public.stock_lot_blocage_modifier(uuid,boolean,text) from public,anon;
grant execute on function public.stock_lot_blocage_modifier(uuid,boolean,text) to authenticated;
commit;
