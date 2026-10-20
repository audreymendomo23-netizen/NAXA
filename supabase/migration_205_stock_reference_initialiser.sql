-- NAXA 205 — initialiser une référence catalogue dans le stock pharmacie avant réception.
begin;
create or replace function public.gestionnaire_stock_reference_initialiser(
 p_pharmacie uuid,p_produit uuid,p_prix integer,p_emplacement text default null
) returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_profile public.profiles%rowtype;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 if p_prix is null or p_prix<0 then raise exception 'Prix de vente invalide'; end if;
 if p_emplacement is not null and char_length(trim(p_emplacement))>160 then raise exception 'Emplacement limité à 160 caractères'; end if;
 if not public.naxa_scope_allows(v_user,p_pharmacie,'PHARMACIE') then raise exception 'Pharmacie hors périmètre'; end if;
 if not exists(select 1 from public.pharmacies p where p.id=p_pharmacie and p.actif=true and p.archivee_le is null) then raise exception 'Pharmacie inactive ou archivée'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur')
  or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
  or public.naxa_has_privilege('MANAGE_LOTS',p_pharmacie,'PHARMACIE')) then raise exception 'Initialisation de stock non autorisée'; end if;
 if not exists(select 1 from public.produits p where p.id=p_produit) then raise exception 'Produit catalogue introuvable'; end if;
 insert into public.stocks(pharmacie_id,produit_id,prix,quantite,emplacement)
 values(p_pharmacie,p_produit,p_prix,0,nullif(trim(coalesce(p_emplacement,'')),''));
 if not found then raise exception 'Référence non initialisée'; end if;
 return true;
exception when unique_violation then
 raise exception 'Cette référence existe déjà dans le stock de cette pharmacie';
end;
$function$;
revoke all on function public.gestionnaire_stock_reference_initialiser(uuid,uuid,integer,text) from public,anon;
grant execute on function public.gestionnaire_stock_reference_initialiser(uuid,uuid,integer,text) to authenticated;
comment on function public.gestionnaire_stock_reference_initialiser(uuid,uuid,integer,text) is
 'Ajoute une référence catalogue au stock pharmacie à quantité zéro, avec prix de vente explicitement choisi; la réception réelle ajoute ensuite les lots.';
commit;
