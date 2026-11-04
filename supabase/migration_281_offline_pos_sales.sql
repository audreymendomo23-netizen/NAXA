-- NAXA F07 — idempotent replay of cash POS sales created while a cashier device is offline.
-- The replay is deliberately delegated to the existing POS transaction/RPCs:
-- vente_creer -> vente_ajouter_produit -> vente_encaisser_finaliser.
-- No direct writes to sales, payment, stock or FEFO tables are performed here.

begin;

create table if not exists public.naxa_offline_sales (
  operation_id uuid primary key,
  device_id uuid not null references public.appareils(id) on delete restrict,
  utilisateur_id uuid not null references public.profiles(id) on delete restrict,
  pharmacie_id uuid not null references public.pharmacies(id) on delete restrict,
  session_id uuid not null references public.caisses_sessions(id) on delete restrict,
  device_sequence bigint not null check (device_sequence > 0),
  modified_at timestamptz not null,
  payload jsonb not null,
  statut text not null default 'processing'
    check (statut in ('processing','applied','conflict','failed','rejected')),
  resultat jsonb,
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  constraint naxa_offline_sales_device_sequence_uidx unique (device_id, device_sequence)
);

create index if not exists naxa_offline_sales_pharmacy_idx
  on public.naxa_offline_sales (pharmacie_id, created_at desc);
create index if not exists naxa_offline_sales_session_idx
  on public.naxa_offline_sales (session_id, created_at desc);

alter table public.naxa_offline_sales enable row level security;
revoke all on public.naxa_offline_sales from public, anon, authenticated;
grant select, insert, update, delete on public.naxa_offline_sales to service_role;

create or replace function public.naxa_apply_offline_sale_v1(
  p_device_id uuid,
  p_operation_id uuid,
  p_payload jsonb,
  p_created_at_ms bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_device public.appareils%rowtype;
  v_profile public.profiles%rowtype;
  v_existing public.naxa_offline_sales%rowtype;
  v_uid uuid;
  v_pharmacy uuid;
  v_session_id uuid;
  v_sale_id uuid;
  v_sale_number text;
  v_sequence bigint;
  v_last_sequence bigint := 0;
  v_modified_at timestamptz;
  v_amount_received integer;
  v_expected_total integer;
  v_server_total integer;
  v_change integer := 0;
  v_product uuid;
  v_quantity integer;
  v_expected_price integer;
  v_server_price integer;
  v_line jsonb;
  v_lines jsonb;
  v_previous_claim_sub text;
  v_error text;
  v_status text;
  v_result jsonb;
begin
  if p_device_id is null or p_operation_id is null
     or jsonb_typeof(coalesce(p_payload,'null'::jsonb)) <> 'object'
     or p_created_at_ms is null or p_created_at_ms <= 0 then
    return jsonb_build_object('status','rejected','reason','invalid_sale_envelope');
  end if;

  select * into v_device
  from public.appareils
  where id=p_device_id
  for update;

  if not found or v_device.actif is distinct from true then
    return jsonb_build_object('status','rejected','reason','device_inactive');
  end if;

  if clock_timestamp()-coalesce(v_device.derniere_synchro,v_device.cree_le) > interval '7 days' then
    return jsonb_build_object('status','rejected','reason','device_expired');
  end if;

  v_uid:=v_device.utilisateur_id;
  v_pharmacy:=v_device.pharmacie_id;
  v_modified_at:=to_timestamp(p_created_at_ms::double precision/1000.0);

  v_previous_claim_sub:=current_setting('request.jwt.claim.sub',true);
  perform pg_catalog.set_config('request.jwt.claim.sub',v_uid::text,true);

  select * into v_existing
  from public.naxa_offline_sales
  where operation_id=p_operation_id
  for update;

  if found then
    perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_previous_claim_sub,''),true);
    if v_existing.device_id<>p_device_id
       or v_existing.utilisateur_id<>v_uid
       or v_existing.pharmacie_id<>v_pharmacy
       or v_existing.payload is distinct from p_payload
       or v_existing.modified_at is distinct from v_modified_at then
      return jsonb_build_object('status','rejected','reason','operation_payload_mismatch');
    end if;
    return coalesce(v_existing.resultat,
      jsonb_build_object('status',v_existing.statut,'reason','operation_already_recorded'));
  end if;

  select * into v_profile from public.profiles where id=v_uid;
  if not found or v_profile.actif is distinct from true
     or v_profile.role::text not in ('caisse','pharmacie')
     or (v_profile.role::text='pharmacie' and nullif(btrim(v_profile.fonction_interne),'') is null)
     or not exists (
       select 1 from public.pharmacies ph
       where ph.id=v_pharmacy and ph.actif is true
     )
     or not public.naxa_scope_allows(v_uid,v_pharmacy,'PHARMACIE')
     or not public.naxa_caisse_actor_for_pharmacy(v_pharmacy) then
    perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_previous_claim_sub,''),true);
    return jsonb_build_object('status','rejected','reason','cashier_or_pharmacy_scope_denied');
  end if;

  begin
    v_session_id:=(p_payload->>'session_id')::uuid;
    v_sequence:=(p_payload->>'naxa_device_sequence')::bigint;
    v_amount_received:=(p_payload->>'montant_percu')::integer;
    v_expected_total:=(p_payload->>'total_attendu')::integer;
    v_lines:=p_payload->'lignes';
  exception when others then
    perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_previous_claim_sub,''),true);
    return jsonb_build_object('status','rejected','reason','invalid_sale_payload');
  end;

  if v_session_id is null or v_sequence is null or v_sequence<=0
     or v_amount_received is null or v_amount_received<=0
     or v_expected_total is null or v_expected_total<=0
     or jsonb_typeof(v_lines)<>'array'
     or jsonb_array_length(v_lines)<1 or jsonb_array_length(v_lines)>50 then
    perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_previous_claim_sub,''),true);
    return jsonb_build_object('status','rejected','reason','invalid_sale_payload');
  end if;

  if v_modified_at<v_device.cree_le
     or v_modified_at>clock_timestamp()+interval '2 minutes' then
    perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_previous_claim_sub,''),true);
    return jsonb_build_object('status','rejected','reason','sale_timestamp_out_of_range');
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_lines) as e(value)
    group by e.value->>'produit_id'
    having count(*)>1
  ) then
    perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_previous_claim_sub,''),true);
    return jsonb_build_object('status','rejected','reason','duplicate_product_lines');
  end if;

  select greatest(
    coalesce((select max(o.device_sequence) from public.offline_operations o where o.device_id=p_device_id),0),
    coalesce((select max(s.device_sequence) from public.naxa_offline_sales s where s.device_id=p_device_id),0)
  ) into v_last_sequence;

  if v_sequence<=v_last_sequence then
    perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_previous_claim_sub,''),true);
    return jsonb_build_object('status','rejected','reason','device_sequence_not_monotonic',
      'last_device_sequence',v_last_sequence);
  end if;

  perform 1
  from public.caisses_sessions cs
  join public.caisses c on c.id=cs.caisse_id
  where cs.id=v_session_id
    and cs.statut='ouverte'
    and cs.ouvert_par=v_uid
    and c.pharmacie_id=v_pharmacy
    and c.actif is true
  for update of cs;

  if not found then
    perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_previous_claim_sub,''),true);
    return jsonb_build_object('status','rejected','reason','cash_session_closed_or_out_of_scope');
  end if;

  insert into public.naxa_offline_sales(
    operation_id,device_id,utilisateur_id,pharmacie_id,session_id,
    device_sequence,modified_at,payload,statut
  ) values (
    p_operation_id,p_device_id,v_uid,v_pharmacy,v_session_id,
    v_sequence,v_modified_at,p_payload,'processing'
  );

  begin
    v_sale_id:=public.vente_creer(v_session_id,null::uuid);

    for v_line in select value from jsonb_array_elements(v_lines)
    loop
      begin
        v_product:=(v_line->>'produit_id')::uuid;
        v_quantity:=(v_line->>'quantite')::integer;
        v_expected_price:=(v_line->>'prix_unitaire')::integer;
      exception when others then
        raise exception 'OFFLINE_SALE_INVALID_LINE';
      end;

      if v_product is null or v_quantity is null or v_quantity<=0
         or v_expected_price is null or v_expected_price<0 then
        raise exception 'OFFLINE_SALE_INVALID_LINE';
      end if;

      select s.prix into v_server_price
      from public.stocks s
      where s.pharmacie_id=v_pharmacy and s.produit_id=v_product
      for update;

      if not found then raise exception 'OFFLINE_SALE_PRODUCT_MISSING'; end if;
      if v_server_price is distinct from v_expected_price then
        raise exception 'OFFLINE_SALE_PRICE_CHANGED';
      end if;

      perform public.vente_ajouter_produit(v_sale_id,v_product,v_quantity);
    end loop;

    select v.total_net into v_server_total
    from public.ventes v
    where v.id=v_sale_id and v.statut='brouillon';

    if not found or v_server_total is null or v_server_total<=0 then
      raise exception 'OFFLINE_SALE_EMPTY_OR_INVALID';
    end if;
    if v_server_total is distinct from v_expected_total then
      raise exception 'OFFLINE_SALE_TOTAL_CHANGED';
    end if;
    if v_amount_received<v_server_total then
      raise exception 'OFFLINE_SALE_CASH_INSUFFICIENT';
    end if;

    perform public.vente_encaisser_finaliser(v_sale_id,v_amount_received);

    select v.numero_vente,v.total_net
      into v_sale_number,v_server_total
    from public.ventes v
    where v.id=v_sale_id and v.statut='payee';

    if not found then raise exception 'OFFLINE_SALE_FINALIZATION_NOT_CONFIRMED'; end if;

    select coalesce(max(vp.monnaie_rendue),0)::integer into v_change
    from public.vente_paiements vp where vp.vente_id=v_sale_id;

    v_result:=jsonb_build_object(
      'status','applied',
      'sale_id',v_sale_id,
      'numero_vente',v_sale_number,
      'total',v_server_total,
      'monnaie_rendue',v_change
    );

    update public.naxa_offline_sales
    set statut='applied',resultat=v_result,applied_at=clock_timestamp()
    where operation_id=p_operation_id;
  exception when others then
    get stacked diagnostics v_error = message_text;
    v_status:=case
      when v_error ilike '%stock%'
        or v_error ilike '%lot%'
        or v_error ilike '%prix%'
        or v_error ilike '%product_missing%'
        or v_error ilike '%vendable%'
        then 'conflict'
      else 'failed'
    end;
    v_result:=jsonb_build_object(
      'status',v_status,
      'reason','offline_sale_requires_resolution',
      'message',case when v_status='conflict'
        then 'Le prix ou le stock disponible a changé depuis la vente. Vérifiez puis ressaisissez cette vente.'
        else 'La vente différée a été refusée par les contrôles de caisse. Vérifiez la session et les données avant une nouvelle saisie.'
      end
    );
    update public.naxa_offline_sales
    set statut=v_status,resultat=v_result
    where operation_id=p_operation_id;
  end;

  perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_previous_claim_sub,''),true);
  return v_result;
end;
$function$;

revoke all on function public.naxa_apply_offline_sale_v1(uuid,uuid,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.naxa_apply_offline_sale_v1(uuid,uuid,jsonb,bigint) to service_role;

commit;
