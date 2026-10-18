-- NAXA 111 — alertes stock/expiration complètes pour les partenaires.
-- Dépend de la migration 105. Lecture seule, limitée aux partenaires de l'utilisateur.
begin;

create or replace function public.get_partner_catalogue_alerts()
returns table(
  product_id uuid,
  partner_id uuid,
  universe_slug text,
  name text,
  stock_quantity numeric,
  low_stock_threshold numeric,
  expires_at date,
  low_stock boolean,
  is_expired boolean,
  days_until_expiry integer
)
language plpgsql
stable
security definer
set search_path=public
as $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Connexion requise' using errcode='28000'; end if;
  if not exists (
    select 1 from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id and pa.status='active'
    where pm.user_id=uid
      and pm.member_role in ('owner','manager','operator')
  ) then
    raise exception 'Accès partenaire requis' using errcode='42501';
  end if;

  return query
  select pp.id,pp.partner_id,pp.universe_slug,pp.name,pp.stock_quantity,pp.low_stock_threshold,
    pp.expires_at,
    (pp.stock_quantity <= pp.low_stock_threshold) as low_stock,
    (pp.expires_at < current_date) as is_expired,
    (pp.expires_at-current_date)::integer as days_until_expiry
  from public.partner_products pp
  where pp.status <> 'archived'
    and pp.universe_slug in ('parapharmacie','bebe-maman')
    and exists (
      select 1 from public.partner_members pm
      join public.partners pa on pa.id=pm.partner_id and pa.status='active'
      where pm.partner_id=pp.partner_id
        and pm.user_id=uid
        and pm.member_role in ('owner','manager','operator')
    )
    and (
      pp.stock_quantity <= pp.low_stock_threshold
      or (pp.expires_at is not null and pp.expires_at <= current_date+30)
    )
  order by pp.expires_at nulls last,pp.name;
end;
$function$;

revoke all on function public.get_partner_catalogue_alerts() from public,anon;
grant execute on function public.get_partner_catalogue_alerts() to authenticated;

commit;
