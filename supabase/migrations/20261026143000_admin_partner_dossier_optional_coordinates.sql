begin;

-- Les coordonnées GPS sont facultatives pour un dossier partenaire; si une coordonnée
-- est fournie, l'autre doit l'être aussi. L'adresse reste obligatoire.
create or replace function public.admin_create_partner_dossier(
  p_owner_user_id uuid,
  p_name text,
  p_partner_type text,
  p_universe_slug text,
  p_city text,
  p_neighborhood text,
  p_address text,
  p_latitude numeric,
  p_longitude numeric,
  p_whatsapp text,
  p_monthly_fee_fcfa bigint,
  p_architecture_code text,
  p_documents_received jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_partner_id uuid;
  v_actor uuid := auth.uid();
begin
  if not public.is_admin() then raise exception 'Accès administrateur requis' using errcode = '42501'; end if;
  if p_owner_user_id is null or not exists (
    select 1 from public.profiles where id=p_owner_user_id
  ) then raise exception 'Compte Promoteur introuvable' using errcode = '23503'; end if;
  -- Le compte propriétaire reste suspendu tant que le dossier est en attente.
  update public.profiles set actif=false where id=p_owner_user_id;
  if length(trim(coalesce(p_name,''))) < 2 or length(trim(coalesce(p_city,''))) < 2
     or length(trim(coalesce(p_address,''))) < 2
     or ((p_latitude is null) <> (p_longitude is null))
     or p_monthly_fee_fcfa is null or p_monthly_fee_fcfa <= 0
     or p_universe_slug not in ('parapharmacie','examens','prestations','aide')
     or p_partner_type is distinct from (case p_universe_slug when 'parapharmacie' then 'parapharmacie' when 'examens' then 'centre_examen' when 'prestations' then 'professionnel_domicile' else 'autre' end)
     or (p_universe_slug='parapharmacie' and p_architecture_code not in ('ORPHELIN','PARENTS_ENFANTS','PARENTS_AINES_CADETS','HYBRIDE'))
     or (p_universe_slug<>'parapharmacie' and p_architecture_code is not null)
     or jsonb_typeof(coalesce(p_documents_received,'{}'::jsonb)) <> 'object'
     or (p_latitude is not null and p_latitude not between -90 and 90)
     or (p_longitude is not null and p_longitude not between -180 and 180) then
    raise exception 'Dossier partenaire invalide' using errcode = '22023';
  end if;
  if not exists (select 1 from public.universes where slug=p_universe_slug) then
    raise exception 'Univers indisponible' using errcode = '23503';
  end if;

  insert into public.partners(
    name, partner_type, city, neighborhood, address_private, phone_private, whatsapp,
    latitude, longitude, status, created_by
  ) values (
    trim(p_name),
    case p_universe_slug
      when 'parapharmacie' then 'parapharmacie'
      when 'examens' then 'centre_examen'
      when 'prestations' then 'professionnel_domicile'
      else 'autre'
    end,
    trim(p_city), nullif(trim(coalesce(p_neighborhood,'')),''),
    nullif(trim(coalesce(p_address,'')),''),
    nullif(trim(coalesce(p_whatsapp,'')),''),
    nullif(trim(coalesce(p_whatsapp,'')),''),
    p_latitude, p_longitude, 'pending', v_actor
  ) returning id into v_partner_id;

  insert into public.partner_universes(partner_id, universe_slug, enabled)
    values (v_partner_id, p_universe_slug, false);
  insert into public.partner_members(partner_id, user_id, member_role)
    values (v_partner_id, p_owner_user_id, 'owner');
  insert into public.admin_partner_dossiers(
    partner_id, promoteur_id, universe_slug, monthly_fee_fcfa, architecture_code,
    documents_received, dossier_status, created_by
  ) values (
    v_partner_id, p_owner_user_id, p_universe_slug, p_monthly_fee_fcfa, p_architecture_code,
    coalesce(p_documents_received,'{}'::jsonb), 'pending', v_actor
  );

  if p_universe_slug='examens' then
    insert into public.exam_centers(partner_id, display_name, address_label, status)
    values (v_partner_id, trim(p_name), nullif(trim(coalesce(p_address,'')),''), 'draft');
  end if;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(v_actor,'partner.dossier_created','admin_partner_dossier',v_partner_id::text,
      jsonb_build_object('universe_slug',p_universe_slug,'owner_user_id',p_owner_user_id,'status','pending'));
  return v_partner_id;
end;
$fn$;
revoke all on function public.admin_create_partner_dossier(uuid,text,text,text,text,text,text,numeric,numeric,text,bigint,text,jsonb) from public, anon;
grant execute on function public.admin_create_partner_dossier(uuid,text,text,text,text,text,text,numeric,numeric,text,bigint,text,jsonb) to authenticated;

commit;
