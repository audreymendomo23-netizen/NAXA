-- NAXA 191 — mise à jour encadrée des emplacements physiques.
begin;
create or replace function public.stock_emplacement_modifier(p_pharmacie uuid,p_produit uuid,p_emplacement text)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_profile public.profiles%rowtype;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 if p_emplacement is not null and char_length(trim(p_emplacement))>160 then raise exception 'Emplacement limité à 160 caractères'; end if;
 if not public.can_access_pharmacy(p_pharmacie) then raise exception 'Pharmacie hors périmètre'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur')
   or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
   or public.naxa_has_privilege('MANAGE_LOTS',p_pharmacie,'PHARMACIE')) then
  raise exception 'Modification d’emplacement non autorisée';
 end if;
 update public.stocks set emplacement=nullif(trim(coalesce(p_emplacement,'')),'')
 where pharmacie_id=p_pharmacie and produit_id=p_produit;
 if not found then raise exception 'Ligne de stock introuvable'; end if;
 return true;
end;
$function$;

create or replace function public.stock_lot_emplacement_modifier(p_lot uuid,p_emplacement text)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_pharmacie uuid; v_user uuid:=auth.uid(); v_profile public.profiles%rowtype;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 if p_emplacement is not null and char_length(trim(p_emplacement))>160 then raise exception 'Emplacement limité à 160 caractères'; end if;
 select pharmacie_id into v_pharmacie from public.stocks_lots where id=p_lot;
 if v_pharmacie is null or not public.can_access_pharmacy(v_pharmacie) then raise exception 'Lot hors périmètre ou introuvable'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur')
   or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
   or public.naxa_has_privilege('MANAGE_LOTS',v_pharmacie,'PHARMACIE')) then
  raise exception 'Modification d’emplacement non autorisée';
 end if;
 update public.stocks_lots set emplacement=nullif(trim(coalesce(p_emplacement,'')),'') where id=p_lot;
 return true;
end;
$function$;
revoke all on function public.stock_emplacement_modifier(uuid,uuid,text) from public,anon;
revoke all on function public.stock_lot_emplacement_modifier(uuid,text) from public,anon;
grant execute on function public.stock_emplacement_modifier(uuid,uuid,text) to authenticated;
grant execute on function public.stock_lot_emplacement_modifier(uuid,text) to authenticated;
commit;
