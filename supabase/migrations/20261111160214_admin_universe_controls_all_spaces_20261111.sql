-- Contrôle global des cinq espaces par l'Admin NAXA.
-- La RPC est SECURITY INVOKER : les droits RLS de l'utilisateur Admin restent actifs.

create or replace function public.admin_set_universe_enabled(
  p_slug text,
  p_enabled boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
begin
  if v_actor is null or not public.is_admin() then
    raise exception 'Action réservée à l’administration' using errcode = '42501';
  end if;

  if p_enabled is null or p_slug not in (
    'parapharmacie',
    'bebe-maman',
    'examens',
    'suivi',
    'prestations'
  ) then
    raise exception 'Univers non configurable' using errcode = '22023';
  end if;

  update public.feature_flags
     set enabled = p_enabled,
         updated_by = v_actor,
         updated_at = now()
   where flag_key = 'universe.' || p_slug;
  if not found then
    raise exception 'Indicateur global introuvable' using errcode = 'P0002';
  end if;

  update public.universes
     set enabled = p_enabled,
         updated_at = now()
   where slug = p_slug;
  if not found then
    raise exception 'Univers introuvable' using errcode = 'P0002';
  end if;

  -- Dispositifs médicaux / suivi connecté partage un unique verrou global.
  if p_slug = 'suivi' then
    update public.feature_flags
       set enabled = p_enabled,
           updated_by = v_actor,
           updated_at = now(),
           description = case
             when p_enabled then 'Le suivi connecté et les dispositifs médicaux sont autorisés par le pilotage global NAXA.'
             else 'Le suivi connecté et les dispositifs médicaux sont suspendus par le verrouillage global NAXA.'
           end
     where flag_key = 'suivi_connecte';
    if not found then
      raise exception 'Verrou technique du suivi introuvable' using errcode = 'P0002';
    end if;
  end if;

  insert into public.audit_log(actor_id, action, entity_type, entity_id, metadata)
  values (
    v_actor,
    case when p_enabled then 'universe.enabled' else 'universe.disabled' end,
    'universe',
    p_slug,
    jsonb_build_object(
      'enabled', p_enabled,
      'source', 'admin_global_universe_control',
      'synchronized_flags',
      case when p_slug = 'suivi'
        then jsonb_build_array('universe.suivi', 'suivi_connecte')
        else jsonb_build_array('universe.' || p_slug)
      end
    )
  );
end;
$function$;

revoke all on function public.admin_set_universe_enabled(text, boolean) from public, anon;
grant execute on function public.admin_set_universe_enabled(text, boolean) to authenticated;

-- L'Admin peut ouvrir globalement Dispositifs médicaux, mais jamais créer
-- une association commerciale partenaire ni publier de dispositifs à la vente.
create or replace function public.guard_medical_devices_phase1()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  row_json jsonb := to_jsonb(NEW);
  slug_value text;
  enabled_value boolean;
  status_value text;
  flag_value text;
begin
  if TG_TABLE_NAME = 'universes' then
    slug_value := row_json->>'slug';
    enabled_value := coalesce((row_json->>'enabled')::boolean, false);
    if slug_value = 'suivi' and enabled_value and not public.is_admin() then
      raise exception 'Seul l’Admin NAXA peut ouvrir globalement Dispositifs médicaux' using errcode = '42501';
    end if;
  elsif TG_TABLE_NAME = 'feature_flags' then
    flag_value := row_json->>'flag_key';
    enabled_value := coalesce((row_json->>'enabled')::boolean, false);
    if flag_value = 'universe.suivi' and enabled_value and not public.is_admin() then
      raise exception 'Seul l’Admin NAXA peut ouvrir globalement Dispositifs médicaux' using errcode = '42501';
    end if;
  elsif TG_TABLE_NAME = 'partner_universes' then
    slug_value := row_json->>'universe_slug';
    enabled_value := coalesce((row_json->>'enabled')::boolean, false);
    if slug_value = 'suivi' and enabled_value then
      raise exception 'Association commerciale partenaire Dispositifs médicaux non autorisée' using errcode = '42501';
    end if;
  elsif TG_TABLE_NAME = 'partner_products' then
    slug_value := row_json->>'universe_slug';
    status_value := row_json->>'status';
    if slug_value = 'suivi' and status_value = 'active' then
      raise exception 'Publication commerciale de dispositifs médicaux non autorisée' using errcode = '42501';
    end if;
  end if;

  return NEW;
end;
$function$;
