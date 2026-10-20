-- NAXA 194 — inventaires transactionnels et ajustements traçables.
begin;

create table if not exists public.inventaire_ajustements (
 id uuid primary key default gen_random_uuid(),
 inventaire_id uuid not null references public.inventaires(id) on delete restrict,
 ligne_id uuid not null references public.inventaire_lignes(id) on delete restrict,
 pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
 produit_id uuid not null references public.produits(id) on delete restrict,
 lot_id uuid references public.stocks_lots(id) on delete restrict,
 quantite_theorique integer not null,
 quantite_comptee integer not null,
 ecart integer generated always as (quantite_comptee-quantite_theorique) stored,
 acteur_id uuid not null references auth.users(id) on delete restrict,
 cree_le timestamptz not null default now()
);
create index if not exists inventaire_ajustements_scope_idx on public.inventaire_ajustements(pharmacie_id,cree_le desc);
create index if not exists inventaire_ajustements_inventaire_idx on public.inventaire_ajustements(inventaire_id);
alter table public.inventaire_ajustements enable row level security;
drop policy if exists inventaire_ajustements_read_scope on public.inventaire_ajustements;
create policy inventaire_ajustements_read_scope on public.inventaire_ajustements
 for select to authenticated using(public.is_admin() or public.can_access_pharmacy(pharmacie_id));
revoke all on public.inventaire_ajustements from public,anon,authenticated;
grant select on public.inventaire_ajustements to authenticated;

create or replace function public.gestionnaire_stock_inventaire_demarrer(
 p_pharmacie uuid,p_type public.inventaire_type,p_reference text default null
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare
 v_user uuid:=auth.uid(); v_profile public.profiles%rowtype; v_inv uuid; v_stock record; v_lot record; v_lot_total integer;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 if p_type is null then raise exception 'Type d’inventaire requis'; end if;
 if p_reference is not null and char_length(trim(p_reference))>80 then raise exception 'Référence limitée à 80 caractères'; end if;
 if not public.can_access_pharmacy(p_pharmacie) then raise exception 'Pharmacie hors périmètre'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur')
   or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
   or public.naxa_has_privilege('MANAGE_LOTS',p_pharmacie,'PHARMACIE')) then
   raise exception 'Démarrage d’inventaire non autorisé';
 end if;
 if exists(select 1 from public.inventaires i where i.pharmacie_id=p_pharmacie and i.statut in ('brouillon','en_cours')) then
   raise exception 'Un inventaire est déjà ouvert pour cette pharmacie';
 end if;
 insert into public.inventaires(pharmacie_id,type,statut,reference,started_at,created_by)
 values(p_pharmacie,p_type,'en_cours',nullif(trim(coalesce(p_reference,'')),''),now(),v_user)
 returning id into v_inv;
 if p_type='complet' then
  for v_stock in select s.produit_id,s.quantite from public.stocks s where s.pharmacie_id=p_pharmacie order by s.produit_id loop
   if exists(select 1 from public.stocks_lots sl where sl.pharmacie_id=p_pharmacie and sl.produit_id=v_stock.produit_id) then
    select coalesce(sum(sl.quantite),0)::integer into v_lot_total from public.stocks_lots sl
     where sl.pharmacie_id=p_pharmacie and sl.produit_id=v_stock.produit_id;
    if v_lot_total<>v_stock.quantite then
     raise exception 'Inventaire interrompu : stock et lots incohérents pour le produit %. Agrégé %, lots %',v_stock.produit_id,v_stock.quantite,v_lot_total;
    end if;
    for v_lot in select sl.id from public.stocks_lots sl where sl.pharmacie_id=p_pharmacie and sl.produit_id=v_stock.produit_id loop
     perform public.inventaire_preparer_ligne(v_inv,v_stock.produit_id,v_lot.id);
    end loop;
   else
    perform public.inventaire_preparer_ligne(v_inv,v_stock.produit_id,null);
   end if;
  end loop;
 end if;
 return v_inv;
end;
$function$;

create or replace function public.gestionnaire_stock_inventaire_ajouter_produit(p_inventaire uuid,p_produit uuid)
returns integer language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_profile public.profiles%rowtype; v_pharmacie uuid; v_quantite integer; v_lot_total integer; v_count integer:=0; v_lot record;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 select i.pharmacie_id,s.quantite into v_pharmacie,v_quantite
 from public.inventaires i join public.stocks s on s.pharmacie_id=i.pharmacie_id
 where i.id=p_inventaire and s.produit_id=p_produit and i.statut in ('brouillon','en_cours');
 if not found or not public.can_access_pharmacy(v_pharmacie) then raise exception 'Inventaire ou produit hors périmètre'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur')
   or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
   or public.naxa_has_privilege('MANAGE_LOTS',v_pharmacie,'PHARMACIE')) then raise exception 'Ajout de ligne non autorisé'; end if;
 if exists(select 1 from public.inventaire_lignes il where il.inventaire_id=p_inventaire and il.produit_id=p_produit) then
  raise exception 'Cette référence est déjà présente dans l’inventaire';
 end if;
 if exists(select 1 from public.stocks_lots sl where sl.pharmacie_id=v_pharmacie and sl.produit_id=p_produit) then
  select coalesce(sum(sl.quantite),0)::integer into v_lot_total from public.stocks_lots sl where sl.pharmacie_id=v_pharmacie and sl.produit_id=p_produit;
  if v_lot_total<>v_quantite then raise exception 'Stock agrégé et lots incohérents; réconciliez avant inventaire'; end if;
  for v_lot in select sl.id from public.stocks_lots sl where sl.pharmacie_id=v_pharmacie and sl.produit_id=p_produit loop
   perform public.inventaire_preparer_ligne(p_inventaire,p_produit,v_lot.id); v_count:=v_count+1;
  end loop;
 else
  perform public.inventaire_preparer_ligne(p_inventaire,p_produit,null); v_count:=1;
 end if;
 return v_count;
end;
$function$;

create or replace function public.gestionnaire_stock_inventaire_compter(p_ligne uuid,p_quantite integer)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_pharmacie uuid; v_profile public.profiles%rowtype;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 if p_quantite is null or p_quantite<0 then raise exception 'Quantité comptée invalide'; end if;
 select i.pharmacie_id into v_pharmacie from public.inventaire_lignes il
 join public.inventaires i on i.id=il.inventaire_id
 where il.id=p_ligne and i.statut in ('brouillon','en_cours');
 if not found or not public.can_access_pharmacy(v_pharmacie) then raise exception 'Ligne d’inventaire fermée ou hors périmètre'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur')
   or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
   or public.naxa_has_privilege('MANAGE_LOTS',v_pharmacie,'PHARMACIE')) then raise exception 'Comptage non autorisé'; end if;
 update public.inventaire_lignes set quantite_comptee=p_quantite where id=p_ligne;
 return found;
end;
$function$;

create or replace function public.inventaire_cloturer(p_inventaire uuid)
returns void language plpgsql security definer set search_path=''
as $function$
declare v_user uuid:=auth.uid(); v_pharmacie uuid; v_profile public.profiles%rowtype; v_line record;
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 select pharmacie_id into v_pharmacie from public.inventaires where id=p_inventaire and statut in ('brouillon','en_cours') for update;
 if not found or not public.can_access_pharmacy(v_pharmacie) then raise exception 'Inventaire non autorisé ou déjà clôturé'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur')
   or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
   or public.naxa_has_privilege('MANAGE_LOTS',v_pharmacie,'PHARMACIE')) then raise exception 'Clôture d’inventaire non autorisée'; end if;
 if not exists(select 1 from public.inventaire_lignes where inventaire_id=p_inventaire) then raise exception 'Impossible de clôturer un inventaire vide'; end if;
 if exists(select 1 from public.inventaire_lignes where inventaire_id=p_inventaire and quantite_comptee is null) then raise exception 'Toutes les lignes doivent être comptées avant clôture'; end if;
 -- Contradiction: une ligne agrégée ne peut pas ajuster un stock qui possède des lots,
 -- sinon le stock agrégé divergerait du détail des lots.
 if exists(select 1 from public.inventaire_lignes il where il.inventaire_id=p_inventaire and il.lot_id is null group by il.produit_id having count(*)>1) then
  raise exception 'Inventaire avec lignes agrégées dupliquées : clôture refusée';
 end if;
 if exists(select 1 from public.inventaire_lignes il where il.inventaire_id=p_inventaire and il.lot_id is null
   and exists(select 1 from public.stocks_lots sl where sl.pharmacie_id=v_pharmacie and sl.produit_id=il.produit_id)) then
  raise exception 'Inventaire préparé sans détail par lot : clôture refusée pour éviter un écart stock/lots. Recréez un inventaire avec le parcours actuel.';
 end if;
 for v_line in select il.id,il.produit_id,il.lot_id,il.quantite_theorique,il.quantite_comptee
   from public.inventaire_lignes il where il.inventaire_id=p_inventaire for update loop
  insert into public.inventaire_ajustements(inventaire_id,ligne_id,pharmacie_id,produit_id,lot_id,quantite_theorique,quantite_comptee,acteur_id)
  values(p_inventaire,v_line.id,v_pharmacie,v_line.produit_id,v_line.lot_id,v_line.quantite_theorique,v_line.quantite_comptee,v_user);
  if v_line.lot_id is not null then
   update public.stocks_lots set quantite=v_line.quantite_comptee,updated_at=now()
    where id=v_line.lot_id and pharmacie_id=v_pharmacie and produit_id=v_line.produit_id;
   if not found then raise exception 'Lot disparu pendant l’inventaire; transaction annulée'; end if;
  else
   update public.stocks set quantite=v_line.quantite_comptee
    where pharmacie_id=v_pharmacie and produit_id=v_line.produit_id;
   if not found then raise exception 'Ligne de stock disparue; transaction annulée'; end if;
  end if;
 end loop;
 update public.stocks s set quantite=(
   select coalesce(sum(sl.quantite),0)::integer from public.stocks_lots sl
   where sl.pharmacie_id=s.pharmacie_id and sl.produit_id=s.produit_id
 ) where s.pharmacie_id=v_pharmacie and exists(
   select 1 from public.inventaire_lignes il where il.inventaire_id=p_inventaire and il.produit_id=s.produit_id and il.lot_id is not null
 );
 update public.inventaires set statut='cloture',closed_at=now(),closed_by=v_user,updated_at=now() where id=p_inventaire;
end;
$function$;

revoke all on function public.gestionnaire_stock_inventaire_demarrer(uuid,public.inventaire_type,text) from public,anon;
revoke all on function public.gestionnaire_stock_inventaire_ajouter_produit(uuid,uuid) from public,anon;
revoke all on function public.gestionnaire_stock_inventaire_compter(uuid,integer) from public,anon;
revoke all on function public.inventaire_cloturer(uuid) from public,anon;
grant execute on function public.gestionnaire_stock_inventaire_demarrer(uuid,public.inventaire_type,text) to authenticated;
grant execute on function public.gestionnaire_stock_inventaire_ajouter_produit(uuid,uuid) to authenticated;
grant execute on function public.gestionnaire_stock_inventaire_compter(uuid,integer) to authenticated;
grant execute on function public.inventaire_cloturer(uuid) to authenticated;
comment on table public.inventaire_ajustements is 'Journal immuable des quantités théoriques, comptées et des écarts appliqués à la clôture d’inventaire.';
commit;
