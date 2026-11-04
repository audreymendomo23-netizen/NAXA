-- NAXA 271 — aligner les corrections de quantité hors ligne et en ligne sur EDIT_STOCK_QUANTITY.
begin;

create or replace function public.offline_stock_set_quantity(
  p_operation_id uuid,
  p_pharmacie_id uuid,
  p_produit_id uuid,
  p_quantite integer,
  p_base_updated_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_op public.offline_operations%rowtype;
  v_stock public.stocks%rowtype;
  v_latest_modified_at timestamptz;
  v_modified_at timestamptz;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  if p_operation_id is null or p_pharmacie_id is null or p_produit_id is null then
    raise exception 'Identifiant d''opération, pharmacie et produit requis';
  end if;
  if p_base_updated_at is null then raise exception 'Horodatage de base requis'; end if;
  if p_quantite is null or p_quantite<0 then raise exception 'Quantité invalide'; end if;

  if not public.naxa_can('EDIT_STOCK_QUANTITY',p_pharmacie_id,null) then
    raise exception 'Privilège EDIT_STOCK_QUANTITY requis pour corriger le stock';
  end if;

  select * into v_op from public.offline_operations where operation_id=p_operation_id for update;
  if not found then
    insert into public.offline_operations(
      operation_id,pharmacie_id,produit_id,operation_type,quantite,base_updated_at,created_by
    ) values(p_operation_id,p_pharmacie_id,p_produit_id,'stock_set_quantity',p_quantite,p_base_updated_at,v_uid)
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
  if exists(select 1 from public.stocks_lots l where l.pharmacie_id=p_pharmacie_id and l.produit_id=p_produit_id) then
    update public.offline_operations set statut='failed',erreur='Stock lotisé : utiliser la gestion des lots',
      resultat=jsonb_build_object('status','failed','reason','lotized_stock_requires_lot_operation'),updated_at=now()
    where operation_id=p_operation_id and created_by=v_uid;
    return jsonb_build_object('status','failed','reason','lotized_stock_requires_lot_operation');
  end if;

  select max(modified_at) into v_latest_modified_at
  from public.offline_operations
  where pharmacie_id=p_pharmacie_id and produit_id=p_produit_id
    and statut='applied' and modified_at is not null;
  v_modified_at:=greatest(clock_timestamp(),coalesce(v_latest_modified_at+interval '1 microsecond',clock_timestamp()));

  perform pg_catalog.set_config('naxa.stock_event_source','online_lww_count',true);
  perform pg_catalog.set_config('naxa.stock_occurred_at',v_modified_at::text,true);
  perform pg_catalog.set_config('naxa.stock_operation_id',p_operation_id::text,true);
  perform pg_catalog.set_config('naxa.stock_actor_id',v_uid::text,true);
  perform pg_catalog.set_config('naxa.stock_motif','Correction de stock en ligne',true);

  update public.stocks set quantite=p_quantite,updated_at=v_modified_at
  where pharmacie_id=p_pharmacie_id and produit_id=p_produit_id;
  if not found then raise exception 'Stock introuvable après verrouillage'; end if;

  update public.offline_operations set statut='applied',applied_at=clock_timestamp(),
    modified_at=v_modified_at,device_id=null,device_sequence=null,
    resultat=jsonb_build_object('status','applied','quantity',p_quantite,'modified_at',v_modified_at),
    erreur=null,updated_at=clock_timestamp()
  where operation_id=p_operation_id and created_by=v_uid;
  return jsonb_build_object('status','applied','quantity',p_quantite,'modified_at',v_modified_at);
end;
$function$;
revoke all on function public.offline_stock_set_quantity(uuid,uuid,uuid,integer,timestamptz) from public,anon;
grant execute on function public.offline_stock_set_quantity(uuid,uuid,uuid,integer,timestamptz) to authenticated;

create or replace function public.naxa_apply_offline_operation_v1(
  p_device_id uuid,
  p_operation_id uuid,
  p_type text,
  p_payload jsonb,
  p_created_at_ms bigint
) returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_device public.appareils%rowtype;
  v_profile public.profiles%rowtype;
  v_op public.offline_operations%rowtype;
  v_stock public.stocks%rowtype;
  v_latest record;
  v_uid uuid;
  v_pharmacy uuid;
  v_product uuid;
  v_quantity integer;
  v_base_updated_at timestamptz;
  v_modified_at timestamptz;
  v_device_sequence bigint;
  v_last_device_sequence bigint;
  v_enabled_at timestamptz;
  v_delta bigint:=0;
  v_final bigint;
  v_operation_exists boolean:=false;
  v_previous_claim_sub text;
  v_can_edit_stock boolean:=false;
begin
  if p_device_id is null or p_operation_id is null then
    return jsonb_build_object('status','rejected','reason','missing_identifier');
  end if;
  select * into v_device from public.appareils where id=p_device_id for update;
  if not found or not v_device.actif then
    return jsonb_build_object('status','rejected','reason','device_inactive');
  end if;
  if now()-coalesce(v_device.derniere_synchro,v_device.cree_le)>interval '7 days' then
    return jsonb_build_object('status','rejected','reason','device_expired');
  end if;

  v_uid:=v_device.utilisateur_id;
  v_pharmacy:=v_device.pharmacie_id;
  select * into v_profile from public.profiles where id=v_uid;
  if not found
    or v_profile.actif is distinct from true
    or v_profile.pharmacie_id is distinct from v_pharmacy
    or v_profile.role::text not in ('pharmacie','caisse')
    or (v_profile.role::text='pharmacie' and nullif(btrim(v_profile.fonction_interne),'') is null)
    or not exists(select 1 from public.pharmacies ph where ph.id=v_pharmacy and ph.actif is true) then
    return jsonb_build_object('status','rejected','reason','professional_inactive_or_role_unauthorized');
  end if;
  if not public.naxa_scope_allows(v_uid,v_pharmacy,'PHARMACIE') then
    return jsonb_build_object('status','rejected','reason','pharmacy_scope_denied');
  end if;
  -- Evaluate the same delegated privilege used by online stock edits, under
  -- the device owner's identity rather than the service_role request identity.
  v_previous_claim_sub:=current_setting('request.jwt.claim.sub',true);
  perform pg_catalog.set_config('request.jwt.claim.sub',v_uid::text,true);
  v_can_edit_stock:=public.naxa_can('EDIT_STOCK_QUANTITY',v_pharmacy,null);
  perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_previous_claim_sub,''),true);
  if not v_can_edit_stock then
    return jsonb_build_object('status','rejected','reason','stock_edit_privilege_denied');
  end if;
  if p_type<>'stock_set_quantity' or jsonb_typeof(coalesce(p_payload,'{}'::jsonb))<>'object' then
    return jsonb_build_object('status','rejected','reason','unsupported_operation');
  end if;

  begin
    v_product:=(p_payload->>'produit_id')::uuid;
    v_quantity:=(p_payload->>'quantite')::integer;
    v_base_updated_at:=(p_payload->>'base_updated_at')::timestamptz;
    v_device_sequence:=(p_payload->>'naxa_device_sequence')::bigint;
  exception when others then
    return jsonb_build_object('status','rejected','reason','invalid_stock_payload');
  end;
  if v_product is null or v_quantity is null or v_quantity<0 or v_base_updated_at is null then
    return jsonb_build_object('status','rejected','reason','invalid_stock_payload');
  end if;
  if v_device_sequence is null or v_device_sequence<=0 then
    return jsonb_build_object('status','rejected','reason','device_sequence_required');
  end if;
  if p_created_at_ms is not null and p_created_at_ms>0 then
    v_modified_at:=to_timestamp(p_created_at_ms::double precision/1000.0);
  end if;
  select enabled_at into v_enabled_at from private.naxa_offline_lww_config where id=true;

  select * into v_op from public.offline_operations where operation_id=p_operation_id for update;
  v_operation_exists:=found;
  if v_operation_exists then
    if v_op.created_by<>v_uid then
      return jsonb_build_object('status','rejected','reason','operation_owner_mismatch');
    end if;
    if v_op.pharmacie_id<>v_pharmacy or v_op.produit_id<>v_product
      or v_op.operation_type<>'stock_set_quantity' or v_op.quantite<>v_quantity
      or v_op.base_updated_at is distinct from v_base_updated_at then
      return jsonb_build_object('status','rejected','reason','operation_payload_mismatch');
    end if;
    if v_op.statut in ('applied','conflict','failed') then
      return coalesce(v_op.resultat,jsonb_build_object('status',v_op.statut));
    end if;
    if v_op.device_id is not null and v_op.device_id<>p_device_id then
      return jsonb_build_object('status','rejected','reason','operation_device_mismatch');
    end if;
    if v_op.device_sequence is not null and v_op.device_sequence is distinct from v_device_sequence then
      return jsonb_build_object('status','rejected','reason','operation_sequence_mismatch');
    end if;
  end if;

  select coalesce(max(device_sequence),0) into v_last_device_sequence
  from public.offline_operations
  where device_id=p_device_id and operation_id<>p_operation_id;
  if v_device_sequence<=coalesce(v_last_device_sequence,0) then
    return jsonb_build_object('status','rejected','reason','device_sequence_not_monotonic',
      'last_device_sequence',v_last_device_sequence);
  end if;

  if not v_operation_exists then
    insert into public.offline_operations(
      operation_id,pharmacie_id,produit_id,operation_type,quantite,base_updated_at,
      created_by,device_id,device_sequence,modified_at,statut
    ) values(
      p_operation_id,v_pharmacy,v_product,'stock_set_quantity',v_quantity,v_base_updated_at,
      v_uid,p_device_id,v_device_sequence,v_modified_at,'pending'
    );
  else
    update public.offline_operations set device_id=p_device_id,device_sequence=v_device_sequence,
      modified_at=v_modified_at
    where operation_id=p_operation_id and created_by=v_uid;
  end if;

  if v_modified_at is null then
    update public.offline_operations set statut='failed',erreur='Horodatage serveur ancré requis',
      resultat=jsonb_build_object('status','failed','reason','trusted_chronology_required'),updated_at=now()
    where operation_id=p_operation_id and created_by=v_uid;
    return jsonb_build_object('status','failed','reason','trusted_chronology_required');
  end if;
  if v_modified_at<v_device.cree_le or v_modified_at>clock_timestamp()+interval '2 minutes' then
    update public.offline_operations set statut='failed',erreur='Horodatage hors de la fenêtre appareil/serveur',
      resultat=jsonb_build_object('status','failed','reason','operation_timestamp_out_of_range'),updated_at=now()
    where operation_id=p_operation_id and created_by=v_uid;
    return jsonb_build_object('status','failed','reason','operation_timestamp_out_of_range');
  end if;
  if v_modified_at<v_enabled_at then
    update public.offline_operations set statut='failed',erreur='Chronologie créée avant activation du journal LWW',
      resultat=jsonb_build_object('status','failed','reason','journal_history_incomplete'),updated_at=now()
    where operation_id=p_operation_id and created_by=v_uid;
    return jsonb_build_object('status','failed','reason','journal_history_incomplete');
  end if;

  select * into v_stock from public.stocks
  where pharmacie_id=v_pharmacy and produit_id=v_product for update;
  if not found then
    update public.offline_operations set statut='failed',erreur='Stock introuvable',
      resultat=jsonb_build_object('status','failed','reason','stock_not_found'),updated_at=now()
    where operation_id=p_operation_id and created_by=v_uid;
    return jsonb_build_object('status','failed','reason','stock_not_found');
  end if;
  if exists(select 1 from public.stocks_lots l where l.pharmacie_id=v_pharmacy and l.produit_id=v_product) then
    update public.offline_operations set statut='failed',erreur='Stock lotisé : utiliser les opérations de lots',
      resultat=jsonb_build_object('status','failed','reason','lotized_stock_requires_lot_operation'),updated_at=now()
    where operation_id=p_operation_id and created_by=v_uid;
    return jsonb_build_object('status','failed','reason','lotized_stock_requires_lot_operation');
  end if;

  select operation_id,modified_at,device_id,device_sequence,quantite into v_latest
  from public.offline_operations
  where pharmacie_id=v_pharmacy and produit_id=v_product
    and statut='applied' and modified_at is not null and operation_id<>p_operation_id
  order by modified_at desc,
    case when device_id is null then 1 else 0 end desc,
    coalesce(device_sequence,0) desc,operation_id::text desc
  limit 1;

  if v_latest.operation_id is not null and
    row(v_modified_at,0::integer,v_device_sequence,p_operation_id::text)
      < row(v_latest.modified_at,
        case when v_latest.device_id is null then 1 else 0 end,
        coalesce(v_latest.device_sequence,0),v_latest.operation_id::text) then
    update public.offline_operations set statut='conflict',erreur='Une correction plus récente a déjà gagné',
      resultat=jsonb_build_object('status','conflict','reason','superseded_by_newer_write',
        'losing_quantity',v_quantity,'winner_operation_id',v_latest.operation_id,
        'winner_modified_at',v_latest.modified_at,'winner_quantity',v_latest.quantite,
        'server_quantity',v_stock.quantite),updated_at=now()
    where operation_id=p_operation_id and created_by=v_uid;
    return jsonb_build_object('status','conflict','reason','superseded_by_newer_write',
      'winner_operation_id',v_latest.operation_id,'winner_modified_at',v_latest.modified_at,
      'winner_quantity',v_latest.quantite,'server_quantity',v_stock.quantite);
  end if;

  select coalesce(sum(quantite_apres::bigint-quantite_avant::bigint),0) into v_delta
  from public.stock_manager_movement_journal
  where pharmacie_id=v_pharmacy and produit_id=v_product
    and source_table='stocks' and event_type='quantite'
    and event_source='online_movement' and occurred_at>v_modified_at
    and quantite_avant is not null and quantite_apres is not null;

  v_final:=v_quantity::bigint+v_delta;
  if v_final<0 or v_final>2147483647 then
    update public.offline_operations set statut='conflict',erreur='Les mouvements postérieurs rendent la correction impossible',
      resultat=jsonb_build_object('status','conflict','reason','subsequent_movements_out_of_range',
        'requested_quantity',v_quantity,'subsequent_movement_delta',v_delta,
        'server_quantity',v_stock.quantite),updated_at=now()
    where operation_id=p_operation_id and created_by=v_uid;
    return jsonb_build_object('status','conflict','reason','subsequent_movements_out_of_range',
      'requested_quantity',v_quantity,'subsequent_movement_delta',v_delta,'server_quantity',v_stock.quantite);
  end if;

  perform pg_catalog.set_config('naxa.stock_event_source','offline_lww_count',true);
  perform pg_catalog.set_config('naxa.stock_occurred_at',v_modified_at::text,true);
  perform pg_catalog.set_config('naxa.stock_operation_id',p_operation_id::text,true);
  perform pg_catalog.set_config('naxa.stock_actor_id',v_uid::text,true);
  perform pg_catalog.set_config('naxa.stock_motif','Correction de stock issue de synchronisation hors ligne',true);

  update public.stocks set quantite=v_final::integer,updated_at=clock_timestamp()
  where pharmacie_id=v_pharmacy and produit_id=v_product;

  update public.offline_operations set statut='applied',applied_at=clock_timestamp(),
    resultat=jsonb_build_object('status','applied','quantity',v_final,'requested_quantity',v_quantity,
      'subsequent_movement_delta',v_delta,'modified_at',v_modified_at),
    erreur=null,updated_at=clock_timestamp()
  where operation_id=p_operation_id and created_by=v_uid;

  return jsonb_build_object('status','applied','quantity',v_final,'requested_quantity',v_quantity,
    'subsequent_movement_delta',v_delta,'modified_at',v_modified_at);
end;
$function$;
revoke all on function public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint) to service_role;

commit;
