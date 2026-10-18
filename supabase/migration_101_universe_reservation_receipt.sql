-- NAXA 101 — lecture contrôlée du reçu de réservation multi-univers.
-- Projection limitée : aucune adresse ni coordonnée privée du partenaire n’est renvoyée.
begin;

create or replace function public.get_universe_reservation_receipt(p_reservation_id uuid)
returns table(
  reservation_id uuid,
  status text,
  total_fcfa integer,
  pickup_code text,
  expires_at timestamptz,
  created_at timestamptz,
  partner_name text,
  universe_slug text,
  items jsonb
)
language plpgsql stable security definer set search_path=public
as $function$
declare
  uid uuid := auth.uid();
  r public.universe_reservations%rowtype;
  allowed boolean;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  select * into r from public.universe_reservations where id=p_reservation_id;
  if not found then raise exception 'Réservation introuvable'; end if;
  select (r.client_id=uid)
    or exists(select 1 from public.partner_members pm where pm.partner_id=r.partner_id and pm.user_id=uid)
    or exists(select 1 from public.profiles p where p.id=uid and p.role='admin')
    into allowed;
  if not allowed then raise exception 'Accès refusé'; end if;

  return query
  select r.id,
    case when r.expires_at<=now() and r.status in ('requested','confirmed','ready') then 'expired' else r.status end,
    r.total_fcfa,r.pickup_code,r.expires_at,r.created_at,pa.name,r.universe_slug,
    coalesce((select jsonb_agg(jsonb_build_object(
      'product_name',ri.product_name,
      'unit_price_fcfa',ri.unit_price_fcfa,
      'quantity',ri.quantity,
      'line_total_fcfa',ri.line_total_fcfa
    ) order by ri.product_name) from public.universe_reservation_items ri where ri.reservation_id=r.id),'[]'::jsonb)
  from public.partners pa where pa.id=r.partner_id;
end;
$function$;
revoke all on function public.get_universe_reservation_receipt(uuid) from public,anon;
grant execute on function public.get_universe_reservation_receipt(uuid) to authenticated;

commit;
