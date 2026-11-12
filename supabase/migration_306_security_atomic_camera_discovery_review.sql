-- NAXA Security phase 6 — revue ONVIF atomique.
-- La caméra, le connecteur, la décision et le journal sont commités dans une seule transaction RPC.
-- Seul le backend service_role peut appeler cette fonction.

create or replace function public.naxa_security_review_discovery_candidate(
  p_candidate_id uuid,
  p_decision text,
  p_zone_label text,
  p_reviewer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_candidate public.naxa_security_camera_discovery_candidates%rowtype;
  v_gateway public.naxa_security_gateways%rowtype;
  v_installation_status text;
  v_pharmacy_active boolean;
  v_pharmacy_visible boolean;
  v_pharmacy_not_archived boolean;
  v_now timestamptz := clock_timestamp();
  v_endpoint text;
  v_parts text[];
  v_scheme text;
  v_host text;
  v_port integer;
  v_path text;
  v_ip inet;
  v_camera_id uuid;
  v_channel_key text;
begin
  if p_candidate_id is null or p_reviewer_id is null
     or p_decision not in ('accept', 'dismiss') then
    raise exception 'Paramètres de revue invalides' using errcode = '22023';
  end if;

  if p_decision = 'accept' and (
    p_zone_label is null
    or length(btrim(p_zone_label)) < 2
    or length(btrim(p_zone_label)) > 100
    or p_zone_label ~ '[<>[:cntrl:]]'
  ) then
    raise exception 'Libellé de zone invalide' using errcode = '22023';
  end if;

  select c.*
    into v_candidate
    from public.naxa_security_camera_discovery_candidates c
   where c.id = p_candidate_id
   for update;

  if not found or v_candidate.status <> 'pending' then
    raise exception 'Candidat absent ou déjà traité' using errcode = 'P0002';
  end if;

  select p.actif, p.visible_recherche, (p.archivee_le is null)
    into v_pharmacy_active, v_pharmacy_visible, v_pharmacy_not_archived
    from public.pharmacies p
   where p.id = v_candidate.pharmacie_id;

  if not found or v_pharmacy_active is distinct from true
     or v_pharmacy_visible is distinct from true
     or v_pharmacy_not_archived is distinct from true then
    raise exception 'Pharmacie indisponible pour la revue' using errcode = '42501';
  end if;

  select g.*
    into v_gateway
    from public.naxa_security_gateways g
   where g.id = v_candidate.gateway_id
     and g.pharmacie_id = v_candidate.pharmacie_id
   for update;

  if not found or v_gateway.tunnel_status = 'revoked' then
    raise exception 'Passerelle absente ou révoquée' using errcode = '42501';
  end if;

  select i.status
    into v_installation_status
    from public.naxa_security_installations i
   where i.id = v_gateway.installation_id
     and i.pharmacie_id = v_candidate.pharmacie_id
   for update;

  if not found or v_installation_status in ('suspended', 'retired') then
    raise exception 'Installation suspendue ou retirée' using errcode = '42501';
  end if;

  if p_decision = 'dismiss' then
    update public.naxa_security_camera_discovery_candidates
       set status = 'dismissed',
           reviewed_by = p_reviewer_id,
           reviewed_at = v_now,
           updated_at = v_now
     where id = v_candidate.id
       and status = 'pending';

    if not found then
      raise exception 'Décision concurrente détectée' using errcode = '40001';
    end if;

    insert into public.naxa_security_access_audit (
      pharmacie_id, actor_id, actor_role, action, resource_type, resource_id,
      justification, audit_metadata
    ) values (
      v_candidate.pharmacie_id, p_reviewer_id, 'promoteur', 'device_update',
      'gateway', v_gateway.id,
      'Candidat ONVIF écarté après revue humaine du Promoteur.',
      jsonb_build_object(
        'operation', 'onvif_candidate_dismissed',
        'candidate_id', v_candidate.id,
        'discovery_key', v_candidate.discovery_key
      )
    );

    return jsonb_build_object(
      'candidate_id', v_candidate.id,
      'camera_id', null,
      'status', 'dismissed'
    );
  end if;

  if coalesce(cardinality(v_candidate.endpoints), 0) < 1
     or cardinality(v_candidate.endpoints) > 4 then
    raise exception 'Endpoints du candidat hors limites' using errcode = '22023';
  end if;

  v_endpoint := v_candidate.endpoints[1];
  v_parts := regexp_match(
    v_endpoint,
    '^(https?)://(\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9.-]+)(:([0-9]{1,5}))?(/[^?#]*)?$'
  );

  if v_parts is null or v_endpoint ~ '[@?#[:cntrl:][:space:]]' then
    raise exception 'Endpoint ONVIF invalide' using errcode = '22023';
  end if;

  v_scheme := lower(v_parts[1]);
  v_host := lower(replace(replace(v_parts[2], '[', ''), ']', ''));
  v_path := coalesce(v_parts[5], '/');
  v_port := coalesce(
    nullif(v_parts[4], '')::integer,
    case when v_scheme = 'https' then 443 else 80 end
  );

  if v_port < 1 or v_port > 65535 or length(v_path) > 256 then
    raise exception 'Port ou chemin endpoint invalide' using errcode = '22023';
  end if;

  if v_host ~ '^[0-9.]+$' then
    begin
      v_ip := v_host::inet;
    exception when others then
      raise exception 'Adresse IPv4 endpoint invalide' using errcode = '22023';
    end;
    if family(v_ip) <> 4 or not (
      v_ip <<= '10.0.0.0/8'::cidr
      or v_ip <<= '172.16.0.0/12'::cidr
      or v_ip <<= '192.168.0.0/16'::cidr
      or v_ip <<= '169.254.0.0/16'::cidr
    ) then
      raise exception 'Endpoint IPv4 non privé' using errcode = '22023';
    end if;
  elsif position(':' in v_host) > 0 then
    begin
      v_ip := v_host::inet;
    exception when others then
      raise exception 'Adresse IPv6 endpoint invalide' using errcode = '22023';
    end;
    if family(v_ip) <> 6 or not (
      v_ip <<= '::1/128'::cidr
      or v_ip <<= 'fc00::/7'::cidr
      or v_ip <<= 'fe80::/10'::cidr
    ) then
      raise exception 'Endpoint IPv6 non local' using errcode = '22023';
    end if;
  elsif not (
    v_host = 'localhost'
    or v_host like '%.local'
    or v_host like '%.lan'
    or v_host like '%.home.arpa'
    or v_host ~ '^[a-z0-9-]{1,63}$'
  ) then
    raise exception 'Nom endpoint non local' using errcode = '22023';
  end if;

  v_channel_key := 'onvif-' || left(v_candidate.discovery_key, 32);

  insert into public.naxa_security_cameras (
    pharmacie_id, gateway_id, channel_key, zone_label,
    onvif_profiles, status, capabilities
  ) values (
    v_candidate.pharmacie_id, v_gateway.id, v_channel_key, btrim(p_zone_label),
    '{}'::text[], 'registered',
    jsonb_build_object(
      'source', 'onvif_ws_discovery',
      'discovery_candidate_id', v_candidate.id,
      'discovery_key', v_candidate.discovery_key,
      'device_id', v_candidate.device_id,
      'device_types', v_candidate.device_types,
      'device_scopes', v_candidate.device_scopes
    )
  )
  on conflict (gateway_id, channel_key) do update
    set updated_at = excluded.updated_at
    where public.naxa_security_cameras.status not in ('disabled', 'retired')
  returning id into v_camera_id;

  if v_camera_id is null then
    raise exception 'Caméra existante désactivée ou retirée' using errcode = '55000';
  end if;

  perform 1
    from public.naxa_security_camera_connections c
   where c.camera_id = v_camera_id
     and c.pharmacie_id = v_candidate.pharmacie_id
     and c.is_primary = true
   for update;

  if not found then
    insert into public.naxa_security_camera_connections (
      pharmacie_id, camera_id, gateway_id, adapter_key, protocol,
      endpoint_host, endpoint_port, endpoint_path, auth_mode, tls_verify,
      connection_status, connection_metadata, is_primary, created_by
    ) values (
      v_candidate.pharmacie_id, v_camera_id, v_gateway.id, 'generic.onvif', 'onvif',
      v_host, v_port, v_path, 'none', true,
      'discovered',
      jsonb_build_object(
        'source', 'onvif_ws_discovery',
        'device_id', v_candidate.device_id,
        'discovery_key', v_candidate.discovery_key
      ),
      true, p_reviewer_id
    );
  end if;

  update public.naxa_security_camera_discovery_candidates
     set status = 'accepted',
         camera_id = v_camera_id,
         reviewed_by = p_reviewer_id,
         reviewed_at = v_now,
         updated_at = v_now
   where id = v_candidate.id
     and status = 'pending';

  if not found then
    raise exception 'Décision concurrente détectée' using errcode = '40001';
  end if;

  insert into public.naxa_security_access_audit (
    pharmacie_id, actor_id, actor_role, action, resource_type, resource_id,
    justification, audit_metadata
  ) values (
    v_candidate.pharmacie_id, p_reviewer_id, 'promoteur', 'device_update',
    'camera', v_camera_id,
    'Appareil ONVIF découvert, vérifié et ajouté à l''inventaire par le Promoteur.',
    jsonb_build_object(
      'operation', 'onvif_candidate_accepted',
      'candidate_id', v_candidate.id,
      'discovery_key', v_candidate.discovery_key
    )
  );

  return jsonb_build_object(
    'candidate_id', v_candidate.id,
    'camera_id', v_camera_id,
    'status', 'accepted',
    'connection_status', 'discovered'
  );
end
$function$;

revoke all on function public.naxa_security_review_discovery_candidate(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.naxa_security_review_discovery_candidate(uuid, text, text, uuid)
  to service_role;

comment on function public.naxa_security_review_discovery_candidate(uuid, text, text, uuid) is
  'Revue ONVIF atomique : inventaire caméra, connecteur discovered, décision humaine et audit append-only dans une seule transaction backend.';
