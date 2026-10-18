-- NAXA 103 — transitions de réservation expirables et configuration atomique.
begin;

create or replace function public.admin_set_universe_enabled(p_slug text,p_enabled boolean)
returns void language plpgsql security definer set search_path=public
as $function$
declare uid uuid := auth.uid();
begin
  if uid is null or not exists(select 1 from public.profiles p where p.id=uid and p.role='admin') then
    raise exception 'Action réservée à l’administration';
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

create or replace function public.admin_set_partner_universe(p_partner_id uuid,p_universe_slug text,p_enabled boolean)
returns void language plpgsql security definer set search_path=public
as $function$
declare uid uuid := auth.uid();
declare partner_status text;
begin
  if uid is null or not exists(select 1 from public.profiles p where p.id=uid and p.role='admin') then
    raise exception 'Action réservée à l’administration';
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

create or replace function public.transition_universe_reservation(p_reservation_id uuid,p_status text)
returns void language plpgsql security definer set search_path=public,extensions
as $function$
declare
  uid uuid := auth.uid();
  r public.universe_reservations%rowtype;
  it record;
  is_admin boolean;
  can_manage boolean;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select * into r from public.universe_reservations where id=p_reservation_id for update;
  if not found then raise exception 'Réservation introuvable'; end if;
  select exists(select 1 from public.profiles p where p.id=uid and p.role='admin') into is_admin;
  select exists(
    select 1 from public.partner_members pm join public.partners pa on pa.id=pm.partner_id
    where pm.partner_id=r.partner_id and pm.user_id=uid
      and pm.member_role in ('owner','manager','operator') and pa.status='active'
  ) into can_manage;

  if r.expires_at<=now() and r.status in ('requested','confirmed','ready') then
    update public.universe_reservations set status='expired',updated_at=now() where id=r.id;
    return;
  end if;
  if p_status='cancelled' and r.client_id=uid and r.status in ('requested','confirmed') then
    update public.universe_reservations set status='cancelled',updated_at=now() where id=r.id;
    return;
  end if;
  if not (is_admin or can_manage) then raise exception 'Action non autorisée'; end if;
  if r.status in ('picked_up','cancelled','expired') then raise exception 'Réservation déjà clôturée'; end if;
  if p_status='confirmed' and r.status='requested' then
    update public.universe_reservations set status='confirmed',updated_at=now() where id=r.id;
  elsif p_status='ready' and r.status in ('requested','confirmed') then
    update public.universe_reservations set status='ready',updated_at=now() where id=r.id;
  elsif p_status='picked_up' and r.status='ready' then
    for it in select ri.product_id,ri.quantity,pp.stock_quantity from public.universe_reservation_items ri
      join public.partner_products pp on pp.id=ri.product_id
      where ri.reservation_id=r.id order by ri.product_id for update of pp
    loop
      if it.stock_quantity < it.quantity then raise exception 'Stock physique insuffisant lors du retrait'; end if;
      update public.partner_products set stock_quantity=stock_quantity-it.quantity,updated_at=now() where id=it.product_id;
      insert into public.stock_movements(partner_id,product_id,quantity_delta,movement_type,reason,reference,created_by)
      values(r.partner_id,it.product_id,-it.quantity,'sale','Retrait confirmé',r.id::text,uid);
    end loop;
    update public.universe_reservations set status='picked_up',picked_up_at=now(),updated_at=now() where id=r.id;
  else
    raise exception 'Transition de statut non autorisée';
  end if;
end;
$function$;

revoke all on function public.admin_set_universe_enabled(text,boolean) from public,anon;
grant execute on function public.admin_set_universe_enabled(text,boolean) to authenticated;
revoke all on function public.admin_set_partner_universe(uuid,text,boolean) from public,anon;
grant execute on function public.admin_set_partner_universe(uuid,text,boolean) to authenticated;
revoke all on function public.transition_universe_reservation(uuid,text) from public,anon;
grant execute on function public.transition_universe_reservation(uuid,text) to authenticated;

commit;
