-- NAXA — publication Admin du modèle de convention autonome et RPC position serveur.
begin;

create or replace function public.admin_publish_partner_independent_agreement_template(
  p_version text,
  p_title text,
  p_body text,
  p_sha256 text
) returns uuid
language plpgsql security definer set search_path=''
as $function$
declare
  v_admin uuid:=auth.uid();
  v_template_id uuid;
begin
  if v_admin is null or not exists(
    select 1 from public.profiles p where p.id=v_admin and p.role='admin' and p.actif=true
  ) then raise exception 'Accès administrateur actif requis' using errcode='42501'; end if;

  if length(trim(coalesce(p_version,'')))<3 or length(trim(p_version))>80
    or length(trim(coalesce(p_title,'')))<3 or length(trim(p_title))>180
    or length(trim(coalesce(p_body,'')))<100
    or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Version, titre, texte juridique ou empreinte SHA-256 invalide' using errcode='22023';
  end if;

  update public.partner_independent_agreement_templates
  set status='archived',updated_at=now()
  where partner_type='professionnel_domicile' and status='published';

  insert into public.partner_independent_agreement_templates(
    partner_type,version,title,body,sha256,status,created_by,published_by,published_at,updated_at
  ) values(
    'professionnel_domicile',trim(p_version),trim(p_title),trim(p_body),p_sha256,
    'published',v_admin,v_admin,now(),now()
  ) returning id into v_template_id;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_admin,'partner.independent_agreement_template_published','partner_independent_agreement_template',v_template_id::text,
    jsonb_build_object('version',trim(p_version),'sha256',p_sha256));

  return v_template_id;
end;
$function$;

revoke all on function public.admin_publish_partner_independent_agreement_template(text,text,text,text) from public,anon;
grant execute on function public.admin_publish_partner_independent_agreement_template(text,text,text,text) to authenticated;

create or replace function public.set_professional_partner_location(
  p_partner_id uuid,
  p_user_id uuid,
  p_latitude numeric,
  p_longitude numeric
)
returns void
language plpgsql
security invoker
set search_path=''
as $function$
declare
  v_reset boolean;
begin
  if p_partner_id is null or p_user_id is null then
    raise exception 'Partenaire ou titulaire manquant' using errcode='22023';
  end if;
  if not private.naxa_partner_has_active_independent_agreement(p_partner_id,p_user_id) then
    raise exception 'Convention indépendante NAXA active requise pour modifier la position du Partenaire' using errcode='42501';
  end if;
  if ((p_latitude is null) <> (p_longitude is null))
    or (p_latitude is not null and (p_latitude not between -90 and 90 or p_longitude not between -180 and 180)) then
    raise exception 'Coordonnées GPS invalides' using errcode='22023';
  end if;
  v_reset:=p_latitude is null;

  update public.partners
  set provider_latitude=p_latitude,
      provider_longitude=p_longitude,
      provider_location_updated_at=case when v_reset then null else now() end,
      provider_location_updated_by=case when v_reset then null else p_user_id end,
      updated_at=now()
  where id=p_partner_id and status='active' and partner_type='professionnel_domicile';
  if not found then raise exception 'Position du Partenaire indépendant non enregistrée'; end if;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(p_user_id,case when v_reset then 'partner.provider_location_reset' else 'partner.provider_location_updated' end,
    'partner',p_partner_id::text,
    jsonb_build_object('latitude',p_latitude,'longitude',p_longitude,'source','independent_partner','uses_admin_fallback',v_reset));
end;
$function$;

revoke all on function public.set_professional_partner_location(uuid,uuid,numeric,numeric) from public,anon,authenticated;
grant execute on function public.set_professional_partner_location(uuid,uuid,numeric,numeric) to service_role;

commit;
