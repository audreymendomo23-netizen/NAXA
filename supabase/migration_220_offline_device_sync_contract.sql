-- NAXA MC-03 — reconcile the device-token sync API with the server-owned offline stock contract.
-- Additive only. Apply first in the isolated Preview/test project; never apply directly to Production.
begin;

create table if not exists public.appareils (
  id uuid primary key default gen_random_uuid(),
  pharmacie_id uuid not null references public.pharmacies(id) on delete cascade,
  utilisateur_id uuid not null references auth.users(id) on delete cascade,
  nom text not null default 'Appareil pharmacie',
  jeton_hash text not null unique,
  cree_le timestamptz not null default now(),
  derniere_synchro timestamptz not null default now(),
  actif boolean not null default true,
  installation_id uuid not null,
  constraint appareils_user_installation_unique unique (utilisateur_id, installation_id)
);
alter table public.appareils enable row level security;
revoke all on public.appareils from public, anon, authenticated;
grant select, insert, update, delete on public.appareils to service_role;

create or replace function public.naxa_apply_offline_operation_v1(
  p_device_id uuid,
  p_operation_id uuid,
  p_type text,
  p_payload jsonb,
  p_created_at_ms bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device public.appareils%rowtype;
  v_profile public.profiles%rowtype;
  v_uid uuid;
  v_pharmacy uuid;
  v_product uuid;
  v_quantity integer;
  v_base_updated_at timestamptz;
  v_op public.offline_operations%rowtype;
  v_stock public.stocks%rowtype;
begin
  if p_device_id is null or p_operation_id is null then
    return jsonb_build_object('status','rejected','reason','missing_identifier');
  end if;
  select * into v_device from public.appareils where id = p_device_id for update;
  if not found or not v_device.actif then
    return jsonb_build_object('status','rejected','reason','device_inactive');
  end if;
  if now() - coalesce(v_device.derniere_synchro,v_device.cree_le) > interval '7 days' then
    return jsonb_build_object('status','rejected','reason','device_expired');
  end if;

  v_uid := v_device.utilisateur_id;
  v_pharmacy := v_device.pharmacie_id;
  select * into v_profile from public.profiles where id = v_uid;
  if not found or v_profile.actif is distinct from true or v_profile.pharmacie_id is distinct from v_pharmacy then
    return jsonb_build_object('status','rejected','reason','professional_inactive');
  end if;
  if not (public.is_admin() or public.naxa_scope_allows(v_uid,v_pharmacy,'PHARMACIE')) then
    return jsonb_build_object('status','rejected','reason','pharmacy_scope_denied');
  end if;
  if p_type <> 'stock_set_quantity' or jsonb_typeof(coalesce(p_payload,'{}'::jsonb)) <> 'object' then
    return jsonb_build_object('status','rejected','reason','unsupported_operation');
  end if;

  begin
    v_product := (p_payload->>'produit_id')::uuid;
    v_quantity := (p_payload->>'quantite')::integer;
    v_base_updated_at := (p_payload->>'base_updated_at')::timestamptz;
  exception when others then
    return jsonb_build_object('status','rejected','reason','invalid_stock_payload');
  end;
  if v_product is null or v_quantity is null or v_quantity < 0 or v_base_updated_at is null then
    return jsonb_build_object('status','rejected','reason','invalid_stock_payload');
  end if;

  select * into v_op from public.offline_operations where operation_id=p_operation_id for update;
  if found then
    if v_op.created_by <> v_uid then
      return jsonb_build_object('status','rejected','reason','operation_owner_mismatch');
    end if;
    if v_op.pharmacie_id <> v_pharmacy or v_op.produit_id <> v_product
       or v_op.operation_type <> 'stock_set_quantity' or v_op.quantite <> v_quantity
       or v_op.base_updated_at is distinct from v_base_updated_at then
      return jsonb_build_object('status','rejected','reason','operation_payload_mismatch');
    end if;
    if v_op.statut in ('applied','conflict','failed') then
      return coalesce(v_op.resultat,jsonb_build_object('status',v_op.statut));
    end if;
  else
    insert into public.offline_operations(operation_id,pharmacie_id,produit_id,operation_type,quantite,base_updated_at,created_by)
    values(p_operation_id,v_pharmacy,v_product,'stock_set_quantity',v_quantity,v_base_updated_at,v_uid)
    on conflict(operation_id) do nothing;
    select * into v_op from public.offline_operations where operation_id=p_operation_id for update;
    if not found or v_op.created_by <> v_uid or v_op.pharmacie_id <> v_pharmacy
       or v_op.produit_id <> v_product or v_op.quantite <> v_quantity
       or v_op.base_updated_at is distinct from v_base_updated_at then
      return jsonb_build_object('status','rejected','reason','operation_id_collision');
    end if;
    if v_op.statut in ('applied','conflict','failed') then
      return coalesce(v_op.resultat,jsonb_build_object('status',v_op.statut));
    end if;
  end if;

  select * into v_stock from public.stocks
   where pharmacie_id=v_pharmacy and produit_id=v_product for update;
  if not found then
    update public.offline_operations set statut='failed',erreur='Stock introuvable',
      resultat=jsonb_build_object('status','failed','reason','stock_not_found'),updated_at=now()
     where operation_id=p_operation_id and created_by=v_uid;
    return jsonb_build_object('status','failed','reason','stock_not_found');
  end if;
  if v_stock.updated_at is distinct from v_base_updated_at then
    update public.offline_operations set statut='conflict',erreur='Le stock serveur a changé depuis la mise en cache',
      resultat=jsonb_build_object('status','conflict','server_quantity',v_stock.quantite,'server_updated_at',v_stock.updated_at),updated_at=now()
     where operation_id=p_operation_id and created_by=v_uid;
    return jsonb_build_object('status','conflict','server_quantity',v_stock.quantite,'server_updated_at',v_stock.updated_at);
  end if;
  if exists(select 1 from public.stocks_lots l where l.pharmacie_id=v_pharmacy and l.produit_id=v_product) then
    update public.offline_operations set statut='failed',erreur='Stock lotisé : utiliser la gestion des lots',
      resultat=jsonb_build_object('status','failed','reason','lotized_stock_requires_lot_operation'),updated_at=now()
     where operation_id=p_operation_id and created_by=v_uid;
    return jsonb_build_object('status','failed','reason','lotized_stock_requires_lot_operation');
  end if;
  update public.stocks set quantite=v_quantity,updated_at=now()
   where pharmacie_id=v_pharmacy and produit_id=v_product and updated_at=v_base_updated_at;
  if not found then
    select * into v_stock from public.stocks where pharmacie_id=v_pharmacy and produit_id=v_product;
    update public.offline_operations set statut='conflict',erreur='Conflit détecté pendant la mise à jour',
      resultat=jsonb_build_object('status','conflict','server_quantity',v_stock.quantite,'server_updated_at',v_stock.updated_at),updated_at=now()
     where operation_id=p_operation_id and created_by=v_uid;
    return jsonb_build_object('status','conflict','server_quantity',v_stock.quantite,'server_updated_at',v_stock.updated_at);
  end if;
  update public.offline_operations set statut='applied',applied_at=now(),
    resultat=jsonb_build_object('status','applied','quantity',v_quantity),erreur=null,updated_at=now()
   where operation_id=p_operation_id and created_by=v_uid;
  return jsonb_build_object('status','applied','quantity',v_quantity);
end;
$$;
revoke all on function public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint) from public, anon, authenticated;
grant execute on function public.naxa_apply_offline_operation_v1(uuid,uuid,text,jsonb,bigint) to service_role;
commit;
