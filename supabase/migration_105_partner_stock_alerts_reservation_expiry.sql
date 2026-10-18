-- NAXA 105 — seuils d'alerte stock et expiration planifiable des réservations.
-- Migration additive, à valider après 098–104. Aucun changement Production automatique.
begin;
alter table public.partner_products add column if not exists low_stock_threshold numeric(12,3) not null default 3 check (low_stock_threshold >= 0 and low_stock_threshold <= 1000000);
create index if not exists partner_products_expiry_alert_idx on public.partner_products(partner_id,expires_at) where status <> 'archived' and expires_at is not null;
create index if not exists partner_products_low_stock_idx on public.partner_products(partner_id,stock_quantity,low_stock_threshold) where status <> 'archived';
create or replace function public.expire_universe_reservations(p_limit integer default 500)
returns integer language plpgsql security definer set search_path=public
as $function$
declare changed integer;
begin
  if coalesce(auth.role(),'') <> 'service_role' and not exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin') then raise exception 'Action réservée à l’administration ou au service'; end if;
  if p_limit < 1 or p_limit > 5000 then raise exception 'Limite invalide'; end if;
  with due as (select id from public.universe_reservations where status in ('requested','confirmed','ready') and expires_at <= now() order by expires_at for update skip locked limit p_limit)
  update public.universe_reservations r set status='expired',updated_at=now() from due where r.id=due.id;
  get diagnostics changed = row_count;
  if changed > 0 then insert into public.audit_log(actor_id,action,entity_type,metadata) values(auth.uid(),'reservations.expired.batch','universe_reservation_batch',jsonb_build_object('count',changed,'processed_at',now())); end if;
  return changed;
end;
$function$;
revoke all on function public.expire_universe_reservations(integer) from public,anon,authenticated;
grant execute on function public.expire_universe_reservations(integer) to service_role;
grant execute on function public.expire_universe_reservations(integer) to authenticated;
commit;
