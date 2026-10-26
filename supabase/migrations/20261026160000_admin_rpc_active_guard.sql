begin;

-- Align all admin RPC authorization with the canonical active-admin guard.
-- Replacing role-only checks prevents a disabled admin profile from mutating data
-- through direct authenticated RPC calls that bypass the Next.js Server Actions.

create or replace function public.admin_set_exam_center_status(p_center_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare v_actor uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'Accès administrateur requis' using errcode = '42501';
  end if;
  if p_status not in ('draft','active','suspended') then
    raise exception 'Statut invalide' using errcode = '22023';
  end if;
  if p_status='active' and not exists(
    select 1 from public.exam_centers c
    join public.partners pa on pa.id=c.partner_id and pa.status='active'
    join public.partner_universes pu on pu.partner_id=pa.id and pu.universe_slug='examens' and pu.enabled
    join public.universes u on u.slug='examens' and u.enabled
    join public.feature_flags ff on ff.flag_key='universe.examens' and ff.enabled
    where c.id=p_center_id
  ) then raise exception 'Partenaire, association ou univers non activé' using errcode='23514'; end if;
  update public.exam_centers set status=p_status,updated_at=now() where id=p_center_id;
  if not found then raise exception 'Centre introuvable' using errcode='P0002'; end if;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'exam_center.status_changed','exam_center',p_center_id::text,jsonb_build_object('status',p_status));
end;
$function$;

create or replace function public.admin_set_exam_pack_status(p_pack_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare v_actor uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'Accès administrateur requis' using errcode='42501';
  end if;
  if p_status not in ('draft','active','archived') then
    raise exception 'Statut invalide' using errcode='22023';
  end if;
  if p_status='active' and not exists(
    select 1 from public.exam_packs p
    join public.exam_centers c on c.id=p.center_id and c.status='active'
    join public.partners pa on pa.id=c.partner_id and pa.status='active'
    join public.partner_universes pu on pu.partner_id=pa.id and pu.universe_slug='examens' and pu.enabled
    join public.universes u on u.slug='examens' and u.enabled
    join public.feature_flags ff on ff.flag_key='universe.examens' and ff.enabled
    where p.id=p_pack_id
  ) then raise exception 'Centre, partenaire, association ou univers non activé' using errcode='23514'; end if;
  update public.exam_packs set status=p_status,updated_at=now() where id=p_pack_id;
  if not found then raise exception 'Pack introuvable' using errcode='P0002'; end if;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'exam_pack.status_changed','exam_pack',p_pack_id::text,jsonb_build_object('status',p_status));
end;
$function$;

create or replace function public.admin_set_exam_service_status(p_service_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare v_actor uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'Accès administrateur requis' using errcode='42501';
  end if;
  if p_status not in ('draft','active','archived') then
    raise exception 'Statut invalide' using errcode='22023';
  end if;
  if p_status='active' and not exists(
    select 1 from public.exam_services s
    join public.exam_centers c on c.id=s.center_id and c.status='active'
    join public.partners pa on pa.id=c.partner_id and pa.status='active'
    join public.partner_universes pu on pu.partner_id=pa.id and pu.universe_slug='examens' and pu.enabled
    join public.universes u on u.slug='examens' and u.enabled
    join public.feature_flags ff on ff.flag_key='universe.examens' and ff.enabled
    where s.id=p_service_id
  ) then raise exception 'Centre, partenaire, association ou univers non activé' using errcode='23514'; end if;
  update public.exam_services set status=p_status,updated_at=now() where id=p_service_id;
  if not found then raise exception 'Examen introuvable' using errcode='P0002'; end if;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'exam_service.status_changed','exam_service',p_service_id::text,jsonb_build_object('status',p_status));
end;
$function$;

create or replace function public.admin_set_home_service_offer_status(p_offer_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare uid uuid := auth.uid(); offer_row public.home_service_offers%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Action réservée à l’administration' using errcode='42501';
  end if;
  if p_status not in ('draft','active','archived') then raise exception 'Statut invalide'; end if;
  select * into offer_row from public.home_service_offers where id=p_offer_id for update;
  if not found then raise exception 'Prestation introuvable'; end if;
  if p_status='active' and not exists(
    select 1 from public.partners p
    join public.partner_universes pu on pu.partner_id=p.id and pu.universe_slug='prestations' and pu.enabled=true
    join public.universes u on u.slug='prestations' and u.enabled=true
    join public.feature_flags ff on ff.flag_key='universe.prestations' and ff.enabled=true
    where p.id=offer_row.partner_id and p.status='active' and p.partner_type='professionnel_domicile'
  ) then raise exception 'Le partenaire et l’univers doivent être actifs'; end if;
  update public.home_service_offers set status=p_status,updated_at=now() where id=p_offer_id;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(uid,'home_service.offer_status','home_service_offer',p_offer_id::text,jsonb_build_object('status',p_status));
end;
$function$;

create or replace function public.admin_set_partner_universe(p_partner_id uuid, p_universe_slug text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  partner_status text;
begin
  if not public.is_admin() then
    raise exception 'Action réservée à l’administration' using errcode='42501';
  end if;
  if p_universe_slug not in ('parapharmacie','bebe-maman','examens','suivi','prestations','aide') then
    raise exception 'Univers invalide';
  end if;
  select status into partner_status from public.partners where id=p_partner_id for update;
  if not found then raise exception 'Partenaire introuvable'; end if;
  if p_enabled and partner_status<>'active' then raise exception 'Le partenaire doit être actif'; end if;
  insert into public.partner_universes(partner_id,universe_slug,enabled)
    values(p_partner_id,p_universe_slug,p_enabled)
    on conflict(partner_id,universe_slug) do update set enabled=excluded.enabled;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(uid,case when p_enabled then 'partner.universe_enabled' else 'partner.universe_disabled' end,
      'partner_universe',p_partner_id::text||':'||p_universe_slug,
      jsonb_build_object('partner_id',p_partner_id,'universe_slug',p_universe_slug,'enabled',p_enabled));
end;
$function$;

create or replace function public.admin_set_universe_enabled(p_slug text, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare uid uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'Action réservée à l’administration' using errcode='42501';
  end if;
  if p_slug not in ('parapharmacie','bebe-maman','examens','suivi','prestations') then
    raise exception 'Univers non configurable';
  end if;
  update public.feature_flags set enabled=p_enabled,updated_by=uid,updated_at=now()
    where flag_key='universe.'||p_slug;
  if not found then raise exception 'Indicateur introuvable'; end if;
  update public.universes set enabled=p_enabled,updated_at=now() where slug=p_slug;
  if not found then raise exception 'Univers introuvable'; end if;
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(uid,case when p_enabled then 'universe.enabled' else 'universe.disabled' end,'universe',p_slug,jsonb_build_object('enabled',p_enabled));
end;
$function$;

commit;
