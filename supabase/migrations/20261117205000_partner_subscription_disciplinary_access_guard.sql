create or replace function private.naxa_partner_has_confirmed_payment(p_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $fn$
  select exists (
    select 1
    from public.admin_partner_dossiers d
    join public.partners pa on pa.id=d.partner_id and pa.status='active'
    join public.partner_universes pu on pu.partner_id=pa.id
      and pu.universe_slug=d.universe_slug and pu.enabled=true
    join public.profiles owner_profile on owner_profile.id=d.promoteur_id and owner_profile.actif=true
    join public.partner_subscriptions s on s.partner_id=d.partner_id
    where d.partner_id=p_partner_id
      and d.dossier_status='validated'
      and not private.naxa_owner_has_active_disciplinary_suspension(d.promoteur_id)
      and (
        (s.status='active' and s.first_confirmed_payment_at is not null
          and s.period_start<=(now() at time zone 'Africa/Douala')::date
          and s.due_date>=(now() at time zone 'Africa/Douala')::date)
        or (s.first_confirmed_payment_at is null
          and s.legacy_access_until is not null
          and s.legacy_access_until>=(now() at time zone 'Africa/Douala')::date)
      )
  );
$fn$;
