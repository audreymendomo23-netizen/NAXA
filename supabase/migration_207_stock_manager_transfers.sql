-- NAXA 207 — transfert interne atomique entre deux pharmacies autorisées.
begin;
create table if not exists public.stock_manager_transfers(
 id uuid primary key default gen_random_uuid(),
 source_pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
 destination_pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
 produit_id uuid not null references public.produits(id) on delete restrict,
 source_lot_id uuid references public.stocks_lots(id) on delete set null,
 destination_lot_id uuid references public.stocks_lots(id) on delete set null,
 numero_lot text,
 quantite integer not null check(quantite>0),
 motif text not null check(char_length(btrim(motif)) between 3 and 500),
 acteur_id uuid not null references auth.users(id) on delete restrict,
 cree_le timestamptz not null default now(),
 check(source_pharmacie_id<>destination_pharmacie_id)
);
create index if not exists stock_manager_transfers_source_idx on public.stock_manager_transfers(source_pharmacie_id,cree_le desc);
create index if not exists stock_manager_transfers_destination_idx on public.stock_manager_transfers(destination_pharmacie_id,cree_le desc);
alter table public.stock_manager_transfers enable row level security;
drop policy if exists stock_manager_transfers_scope_read on public.stock_manager_transfers;
create policy stock_manager_transfers_scope_read on public.stock_manager_transfers
 for select to authenticated using(public.is_admin()
  or public.naxa_scope_allows((select auth.uid()),source_pharmacie_id,'PHARMACIE')
  or public.naxa_scope_allows((select auth.uid()),destination_pharmacie_id,'PHARMACIE'));
revoke all on public.stock_manager_transfers from public,anon,authenticated;
grant select on public.stock_manager_transfers to authenticated;

create or replace function public.gestionnaire_stock_transfert_atomique(
 p_source uuid,p_destination uuid,p_produit uuid,p_quantite integer,p_lot uuid,p_motif text
) returns uuid language plpgsql security definer set search_path=''
as $function$
declare
 v_user uuid:=auth.uid(); v_profile public.profiles%rowtype;
 v_source_stock public.stocks%rowtype; v_destination_stock public.stocks%rowtype;
 v_source_exists boolean:=false; v_destination_exists boolean:=false;
 v_source_has_lots boolean; v_destination_has_lots boolean;
 v_source_lot public.stocks_lots%rowtype; v_destination_lot public.stocks_lots%rowtype;
 v_source_lot_sum integer; v_destination_lot_sum integer;
 v_destination_lot_id uuid; v_transfer uuid;
 v_motif text:=nullif(trim(coalesce(p_motif,'')),'');
begin
 if v_user is null then raise exception 'Connexion requise'; end if;
 if p_source is null or p_destination is null or p_source=p_destination then raise exception 'Deux pharmacies différentes sont requises'; end if;
 if p_quantite is null or p_quantite<1 or p_quantite>1000000 then raise exception 'Quantité de transfert invalide'; end if;
 if v_motif is null or char_length(v_motif)<3 or char_length(v_motif)>500 then raise exception 'Un motif de transfert de 3 à 500 caractères est obligatoire'; end if;
 if not public.naxa_scope_allows(v_user,p_source,'PHARMACIE') or not public.naxa_scope_allows(v_user,p_destination,'PHARMACIE') then raise exception 'Les deux pharmacies doivent appartenir au périmètre autorisé'; end if;
 select * into v_profile from public.profiles where id=v_user and actif=true;
 if not found or not (coalesce(v_profile.role::text,'') in ('admin','promoteur')
  or coalesce(v_profile.fonction_interne,'') in ('pharmacien','pharmacien_assistant','responsable','gestionnaire_stock','magasinier')
  or (public.naxa_has_privilege('MANAGE_LOTS',p_source,'PHARMACIE') and public.naxa_has_privilege('MANAGE_LOTS',p_destination,'PHARMACIE'))) then raise exception 'Transfert non autorisé'; end if;

 -- Verrouiller les lignes agrégées dans un ordre stable avant toute ligne de lot.
 perform 1 from public.stocks s where s.pharmacie_id in (p_source,p_destination) and s.produit_id=p_produit order by s.pharmacie_id for update;
 select * into v_source_stock from public.stocks s where s.pharmacie_id=p_source and s.produit_id=p_produit;
 v_source_exists:=found;
 if not v_source_exists then raise exception 'Référence source absente du stock'; end if;
 select * into v_destination_stock from public.stocks s where s.pharmacie_id=p_destination and s.produit_id=p_produit;
 v_destination_exists:=found;
 if v_source_stock.quantite<p_quantite then raise exception 'Stock source insuffisant'; end if;
 select exists(select 1 from public.stocks_lots sl where sl.pharmacie_id=p_source and sl.produit_id=p_produit) into v_source_has_lots;
 select exists(select 1 from public.stocks_lots sl where sl.pharmacie_id=p_destination and sl.produit_id=p_produit) into v_destination_has_lots;

 if v_source_has_lots then
  if p_lot is null then raise exception 'Choisissez le lot source à transférer'; end if;
  select * into v_source_lot from public.stocks_lots sl
   where sl.id=p_lot and sl.pharmacie_id=p_source and sl.produit_id=p_produit for update;
  if not found then raise exception 'Lot source introuvable'; end if;
  if v_source_lot.bloque or v_source_lot.date_peremption is null or v_source_lot.date_peremption<current_date then raise exception 'Un lot bloqué, périmé ou sans date ne peut pas être transféré'; end if;
  if v_source_lot.quantite<p_quantite then raise exception 'Quantité du lot source insuffisante'; end if;
  select coalesce(sum(sl.quantite),0)::integer into v_source_lot_sum from public.stocks_lots sl where sl.pharmacie_id=p_source and sl.produit_id=p_produit;
  if v_source_lot_sum<>v_source_stock.quantite then raise exception 'Stock source et lots incohérents'; end if;
  if v_destination_has_lots then
   if not v_destination_exists then raise exception 'Des lots destination existent sans ligne de stock : réconciliation requise'; end if;
   select coalesce(sum(sl.quantite),0)::integer into v_destination_lot_sum from public.stocks_lots sl where sl.pharmacie_id=p_destination and sl.produit_id=p_produit;
   if v_destination_lot_sum<>v_destination_stock.quantite then raise exception 'Stock destination et lots incohérents'; end if;
  elsif v_destination_exists and v_destination_stock.quantite<>0 then
   raise exception 'La destination contient un stock non lotisé : réconciliation requise avant transfert';
  end if;
 else
  if p_lot is not null then raise exception 'La référence source n’est pas lotisée'; end if;
  if v_destination_has_lots then raise exception 'La destination est lotisée alors que la source ne l’est pas'; end if;
 end if;

 if not v_destination_exists then
  insert into public.stocks(pharmacie_id,produit_id,prix,quantite)
   values(p_destination,p_produit,v_source_stock.prix,0)
   returning * into v_destination_stock;
  v_destination_exists:=true;
 end if;

 perform pg_catalog.set_config('naxa.stock_motif','Transfert '||p_source::text||' vers '||p_destination::text||' : '||v_motif,true);
 if v_source_has_lots then
  update public.stocks_lots set quantite=quantite-p_quantite,updated_at=now() where id=p_lot;
  if v_destination_has_lots then
   select * into v_destination_lot from public.stocks_lots sl
    where sl.pharmacie_id=p_destination and sl.produit_id=p_produit and sl.numero_lot=v_source_lot.numero_lot for update;
   if found then
    if v_destination_lot.date_peremption is distinct from v_source_lot.date_peremption or v_destination_lot.bloque then raise exception 'Le lot de destination a une péremption différente ou est bloqué'; end if;
    update public.stocks_lots set quantite=quantite+p_quantite,updated_at=now() where id=v_destination_lot.id returning id into v_destination_lot_id;
   else
    insert into public.stocks_lots(pharmacie_id,produit_id,lot,peremption,numero_lot,date_peremption,quantite,bloque,motif_blocage,emplacement)
    values(p_destination,p_produit,v_source_lot.numero_lot,v_source_lot.date_peremption,v_source_lot.numero_lot,v_source_lot.date_peremption,p_quantite,false,null,null)
    returning id into v_destination_lot_id;
   end if;
  end if;
 end if;
 update public.stocks set quantite=quantite-p_quantite where pharmacie_id=p_source and produit_id=p_produit;
 update public.stocks set quantite=quantite+p_quantite where pharmacie_id=p_destination and produit_id=p_produit;

 insert into public.stock_manager_transfers(source_pharmacie_id,destination_pharmacie_id,produit_id,source_lot_id,destination_lot_id,numero_lot,quantite,motif,acteur_id)
 values(p_source,p_destination,p_produit,case when v_source_has_lots then p_lot else null end,v_destination_lot_id,
  case when v_source_has_lots then v_source_lot.numero_lot else null end,p_quantite,v_motif,v_user)
 returning id into v_transfer;
 return v_transfer;
end;
$function$;

revoke all on function public.gestionnaire_stock_transfert_atomique(uuid,uuid,uuid,integer,uuid,text) from public,anon;
grant execute on function public.gestionnaire_stock_transfert_atomique(uuid,uuid,uuid,integer,uuid,text) to authenticated;
comment on function public.gestionnaire_stock_transfert_atomique(uuid,uuid,uuid,integer,uuid,text) is
 'Transfère atomiquement une quantité entre deux pharmacies autorisées, en conservant la traçabilité du lot, sa péremption et la cohérence stock agrégé/lots.';
commit;
