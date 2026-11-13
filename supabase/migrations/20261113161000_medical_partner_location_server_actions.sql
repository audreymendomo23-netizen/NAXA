-- NAXA — écritures atomiques et auditées des positions admin / professionnel.
-- Ces fonctions sont appelées uniquement depuis les actions serveur avec la clé service_role.
-- SECURITY INVOKER : aucune élévation de privilèges supplémentaire.

begin;

create or replace function public.admin_set_professional_partner_location(
  p_partner_id uuid,
  p_actor_id uuid,
  p_latitude numeric,
  p_longitude numeric
)
returns void
language plpgsql
security invoker
set search_path=''
as $function$
begin
  if p_actor_id is null or not exists(
    select 1 from public.profiles p
    where p.id=p_actor_id and p.role='admin' and p.actif=true
  ) then
    raise exception 'Accès administrateur actif requis' using errcode='42501';
  end if;
  if p_partner_id is null or p_latitude is null or p_longitude is null
    or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Coordonnées ou partenaire invalides' using errcode='22023';
  end if;
  if not exists(select 1 from public.partners where id=p_partner_id and partner_type='professionnel_domicile') then
    raise exception 'Partenaire de soins à domicile introuvable' using errcode='P0002';
  end if;

  update public.partners
  set latitude=p_latitude,
      longitude=p_longitude,
      admin_location_updated_at=now(),
      admin_location_updated_by=p_actor_id,
      updated_at=now()
  where id=p_partner_id and partner_type='professionnel_domicile';

  if not found then raise exception 'Position administrative non enregistrée'; end if;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(p_actor_id,'partner.admin_location_updated','partner',p_partner_id::text,
    jsonb_build_object('latitude',p_latitude,'longitude',p_longitude,'source','admin'));
end;
$function$;

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
    raise exception 'Professionnel ou partenaire manquant' using errcode='22023';
  end if;
  if not exists(select 1 from public.profiles p where p.id=p_user_id and p.actif=true) then
    raise exception 'Compte professionnel inactif' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.partner_members pm
    join public.partners p on p.id=pm.partner_id
    where pm.partner_id=p_partner_id and pm.user_id=p_user_id
      and pm.member_role in ('owner','manager','operator')
      and p.status='active' and p.partner_type='professionnel_domicile'
  ) then
    raise exception 'Affectation active au partenaire requise' using errcode='42501';
  end if;

  if ((p_latitude is null) <> (p_longitude is null))
    or (p_latitude is not null and (p_latitude not between -90 and 90 or p_longitude not between -180 and 180)) then
    raise exception 'Coordonnées GPS invalides' using errcode='22023';
  end if;
  v_reset := p_latitude is null;

  update public.partners
  set provider_latitude=p_latitude,
      provider_longitude=p_longitude,
      provider_location_updated_at=case when v_reset then null else now() end,
      provider_location_updated_by=case when v_reset then null else p_user_id end,
      updated_at=now()
  where id=p_partner_id and status='active' and partner_type='professionnel_domicile';

  if not found then raise exception 'Position professionnelle non enregistrée'; end if;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(p_user_id,case when v_reset then 'partner.provider_location_reset' else 'partner.provider_location_updated' end,
    'partner',p_partner_id::text,
    jsonb_build_object('latitude',p_latitude,'longitude',p_longitude,'source','provider','uses_admin_fallback',v_reset));
end;
$function$;

revoke all on function public.admin_set_professional_partner_location(uuid,uuid,numeric,numeric) from public,anon,authenticated;
revoke all on function public.set_professional_partner_location(uuid,uuid,numeric,numeric) from public,anon,authenticated;
grant execute on function public.admin_set_professional_partner_location(uuid,uuid,numeric,numeric) to service_role;
grant execute on function public.set_professional_partner_location(uuid,uuid,numeric,numeric) to service_role;

commit;
