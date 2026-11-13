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
  select exists(select 1 from public.partner_members pm where pm.partner_id=r.partner_id and pm.user_id=uid and pm.member_role in ('owner','manager','operator')) into can_manage;

  if p_status='cancelled' and r.client_id=uid and r.status in ('requested','confirmed') then
    if r.payment_mode in ('orange_money','mtn_momo') then
      if r.payment_status<>'awaiting_payment' then
        raise exception 'Le SMS payeur a déjà été soumis ou le paiement est rapproché ; annulation directe refusée. Contactez le partenaire pour traiter le dossier.';
      end if;
      if exists (
        select 1 from public.naxa_universe_payment_intents i
        where i.reservation_id=r.id and i.status in ('submitted','matched')
      ) then
        raise exception 'Un SMS payeur a déjà été soumis ; annulation directe refusée.';
      end if;
      update public.naxa_universe_payment_intents
      set status='cancelled',updated_at=now()
      where reservation_id=r.id and status='active';
      update public.universe_reservations
      set status='cancelled',payment_mode=null,payment_status='not_required',updated_at=now()
      where id=r.id;
    else
      update public.universe_reservations set status='cancelled',updated_at=now() where id=r.id;
    end if;
    return;
  end if;
  if not (is_admin or can_manage) then raise exception 'Action non autorisée'; end if;
  if r.status in ('picked_up','cancelled','expired') then raise exception 'Réservation déjà clôturée'; end if;
  if p_status='confirmed' and r.status='requested' then
    update public.universe_reservations set status='confirmed',updated_at=now() where id=r.id;
  elsif p_status='ready' and r.status in ('requested','confirmed') then
    update public.universe_reservations set status='ready',updated_at=now() where id=r.id;
  elsif p_status='picked_up' and r.status='ready' then
    if r.payment_mode in ('orange_money','mtn_momo') and r.payment_status<>'confirmed' then
      raise exception 'Le paiement électronique doit être rapproché par les deux SMS avant le retrait';
    end if;
    for it in select ri.product_id,ri.quantity,pp.stock_quantity
      from public.universe_reservation_items ri
      join public.partner_products pp on pp.id=ri.product_id
      where ri.reservation_id=r.id
      order by ri.product_id
      for update of pp
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

revoke all on function public.transition_universe_reservation(uuid,text) from public,anon;
grant execute on function public.transition_universe_reservation(uuid,text) to authenticated;
