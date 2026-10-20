-- NAXA ERP-012 — make offline operation state server-owned and replay payload immutable.
begin;
drop policy if exists offline_operations_insert_scope on public.offline_operations;
drop policy if exists offline_operations_update_own on public.offline_operations;
revoke insert,update,delete on public.offline_operations from public,anon,authenticated;
grant select on public.offline_operations to authenticated;

create or replace function public.offline_stock_set_quantity(
 p_operation_id uuid,p_pharmacie_id uuid,p_produit_id uuid,p_quantite integer,p_base_updated_at timestamptz
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=auth.uid(); v_op public.offline_operations%rowtype; v_stock public.stocks%rowtype;
begin
 if v_uid is null then raise exception 'Connexion requise'; end if;
 if p_operation_id is null or p_pharmacie_id is null or p_produit_id is null then raise exception 'Identifiant d''opération, pharmacie et produit requis'; end if;
 if p_base_updated_at is null then raise exception 'Horodatage de base requis'; end if;
 if p_quantite is null or p_quantite<0 then raise exception 'Quantité invalide'; end if;
 if not (public.is_admin() or public.naxa_scope_allows(v_uid,p_pharmacie_id,'PHARMACIE')) then raise exception 'Pharmacie hors périmètre'; end if;

 select * into v_op from public.offline_operations where operation_id=p_operation_id for update;
 if not found then
  insert into public.offline_operations(operation_id,pharmacie_id,produit_id,operation_type,quantite,base_updated_at,created_by)
  values(p_operation_id,p_pharmacie_id,p_produit_id,'stock_set_quantity',p_quantite,p_base_updated_at,v_uid)
  on conflict(operation_id) do nothing;
  select * into v_op from public.offline_operations where operation_id=p_operation_id for update;
  if not found then raise exception 'Impossible de réserver l’identifiant de synchronisation'; end if;
 end if;

 if v_op.created_by<>v_uid then raise exception 'Identifiant d’opération déjà utilisé par un autre compte'; end if;
 if v_op.pharmacie_id<>p_pharmacie_id or v_op.produit_id<>p_produit_id
    or v_op.operation_type<>'stock_set_quantity' or v_op.quantite<>p_quantite
    or v_op.base_updated_at is distinct from p_base_updated_at then
  raise exception 'Identifiant d’opération déjà associé à un contenu différent';
 end if;
 if v_op.statut in ('applied','conflict','failed') then
  return coalesce(v_op.resultat,jsonb_build_object('status',v_op.statut));
 end if;

 select * into v_stock from public.stocks
 where pharmacie_id=p_pharmacie_id and produit_id=p_produit_id for update;
 if not found then
  update public.offline_operations set statut='failed',erreur='Stock introuvable',
    resultat=jsonb_build_object('status','failed','reason','stock_not_found'),updated_at=now()
  where operation_id=p_operation_id and created_by=v_uid;
  return jsonb_build_object('status','failed','reason','stock_not_found');
 end if;

 if v_stock.updated_at is distinct from p_base_updated_at then
  update public.offline_operations set statut='conflict',erreur='Le stock serveur a changé depuis la mise en cache',
    resultat=jsonb_build_object('status','conflict','server_quantity',v_stock.quantite,'server_updated_at',v_stock.updated_at),updated_at=now()
  where operation_id=p_operation_id and created_by=v_uid;
  return jsonb_build_object('status','conflict','server_quantity',v_stock.quantite,'server_updated_at',v_stock.updated_at);
 end if;

 if exists(select 1 from public.stocks_lots l where l.pharmacie_id=p_pharmacie_id and l.produit_id=p_produit_id) then
  update public.offline_operations set statut='failed',erreur='Stock lotisé : utiliser la gestion des lots',
    resultat=jsonb_build_object('status','failed','reason','lotized_stock_requires_lot_operation'),updated_at=now()
  where operation_id=p_operation_id and created_by=v_uid;
  return jsonb_build_object('status','failed','reason','lotized_stock_requires_lot_operation');
 end if;

 update public.stocks set quantite=p_quantite,updated_at=now()
 where pharmacie_id=p_pharmacie_id and produit_id=p_produit_id and updated_at=p_base_updated_at;
 if not found then
  select * into v_stock from public.stocks where pharmacie_id=p_pharmacie_id and produit_id=p_produit_id;
  update public.offline_operations set statut='conflict',erreur='Conflit détecté pendant la mise à jour',
    resultat=jsonb_build_object('status','conflict','server_quantity',v_stock.quantite,'server_updated_at',v_stock.updated_at),updated_at=now()
  where operation_id=p_operation_id and created_by=v_uid;
  return jsonb_build_object('status','conflict','server_quantity',v_stock.quantite,'server_updated_at',v_stock.updated_at);
 end if;

 update public.offline_operations set statut='applied',applied_at=now(),
   resultat=jsonb_build_object('status','applied','quantity',p_quantite),erreur=null,updated_at=now()
 where operation_id=p_operation_id and created_by=v_uid;
 return jsonb_build_object('status','applied','quantity',p_quantite);
end;
$$;
revoke execute on function public.offline_stock_set_quantity(uuid,uuid,uuid,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.offline_stock_set_quantity(uuid,uuid,uuid,integer,timestamptz) to authenticated;
commit;