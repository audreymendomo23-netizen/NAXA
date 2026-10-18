-- NAXA 124 — aligner les accès des prestations à domicile sur le type réel du partenaire.
-- Additif et non destructif : aucune donnée métier n'est modifiée.
begin;

drop policy if exists home_service_requests_partner_read on public.home_service_requests;
create policy home_service_requests_partner_read
on public.home_service_requests
for select to authenticated
using (
  exists (
    select 1
    from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
    where pm.partner_id=home_service_requests.partner_id
      and pm.user_id=(select auth.uid())
      and pm.member_role in ('owner','manager','operator')
      and pa.status='active'
      and pa.partner_type='professionnel_domicile'
  )
);

drop policy if exists home_service_request_addresses_confirmed_partner_read on public.home_service_request_addresses;
create policy home_service_request_addresses_confirmed_partner_read
on public.home_service_request_addresses
for select to authenticated
using (
  exists (
    select 1
    from public.home_service_requests r
    join public.partner_members pm on pm.partner_id=r.partner_id
    join public.partners pa on pa.id=pm.partner_id
    where r.id=home_service_request_addresses.request_id
      and r.status in ('confirmed','completed')
      and pm.user_id=(select auth.uid())
      and pm.member_role in ('owner','manager','operator')
      and pa.status='active'
      and pa.partner_type='professionnel_domicile'
  )
);

-- Même contrôle côté RPC SECURITY DEFINER : ne pas dépendre uniquement de la RLS.
create or replace function public.transition_home_service_request(p_request_id uuid,p_status text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  uid uuid := auth.uid();
  r public.home_service_requests%rowtype;
  is_admin boolean;
  can_manage boolean;
begin
  if uid is null then raise exception 'Connexion requise'; end if;

  select * into r
  from public.home_service_requests
  where id=p_request_id
  for update;
  if not found then raise exception 'Demande introuvable'; end if;

  select exists(
    select 1 from public.profiles p
    where p.id=uid and p.role='admin'
  ) into is_admin;

  select exists(
    select 1
    from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id
    where pm.partner_id=r.partner_id
      and pm.user_id=uid
      and pm.member_role in ('owner','manager','operator')
      and pa.status='active'
      and pa.partner_type='professionnel_domicile'
  ) into can_manage;

  if p_status='cancelled' and r.client_id=uid and r.status in ('requested','confirmed') then
    update public.home_service_requests
      set status='cancelled',updated_at=now()
      where id=r.id;
    insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
    values(uid,'home_service.cancelled','home_service_request',r.id::text,'{"by":"client"}'::jsonb);
    return;
  end if;

  if not (is_admin or can_manage) then
    raise exception 'Action non autorisée' using errcode='42501';
  end if;
  if r.status in ('completed','cancelled','expired') then
    raise exception 'Demande déjà clôturée';
  end if;

  if p_status='confirmed' and r.status='requested' then
    update public.home_service_requests
      set status='confirmed',confirmed_at=now(),updated_at=now()
      where id=r.id;
  elsif p_status='completed' and r.status='confirmed' then
    update public.home_service_requests
      set status='completed',completed_at=now(),updated_at=now()
      where id=r.id;
  else
    raise exception 'Transition de statut non autorisée';
  end if;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(uid,'home_service.'||p_status,'home_service_request',r.id::text,
    jsonb_build_object('partner_id',r.partner_id));
end;
$function$;

revoke all on function public.transition_home_service_request(uuid,text) from public,anon;
grant execute on function public.transition_home_service_request(uuid,text) to authenticated;

commit;
