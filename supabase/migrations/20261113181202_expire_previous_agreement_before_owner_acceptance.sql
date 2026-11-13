-- NAXA — expirer l'ancien accord avant l'acceptation d'une nouvelle version.
create or replace function public.partner_independent_agreement_accept(p_partner_id uuid)
returns uuid
language plpgsql security definer set search_path=''
as $function$
declare
  v_user uuid:=auth.uid();
  v_template public.partner_independent_agreement_templates%rowtype;
  v_agreement_id uuid;
begin
  if v_user is null then raise exception 'Connexion requise' using errcode='42501'; end if;
  if not exists(select 1 from public.profiles p where p.id=v_user and p.actif=true) then
    raise exception 'Compte actif requis' using errcode='42501';
  end if;
  if not exists(
    select 1 from public.partners pa
    join public.partner_members pm on pm.partner_id=pa.id
    where pa.id=p_partner_id and pa.partner_type='professionnel_domicile'
      and pa.status='active' and pm.user_id=v_user and pm.member_role='owner'
  ) then
    raise exception 'Seul le titulaire du Partenaire indépendant actif peut accepter la convention' using errcode='42501';
  end if;

  with expired as (
    update public.partner_independent_agreements
    set status='expired',
        decision_reason=coalesce(decision_reason,'Convention arrivée à expiration'),
        updated_at=now()
    where partner_id=p_partner_id and status='active'
      and expires_at is not null and expires_at<=now()
    returning id,partner_id
  )
  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  select v_user,'partner.independent_agreement_expired','partner_independent_agreement',id::text,
    jsonb_build_object('partner_id',partner_id,'expired_at',now())
  from expired;

  select * into v_template
  from public.partner_independent_agreement_templates
  where partner_type='professionnel_domicile' and status='published'
  order by published_at desc limit 1;
  if not found then
    raise exception 'Aucune convention NAXA publiée pour les Partenaires Prestations et soins à domicile' using errcode='55000';
  end if;
  if exists(
    select 1 from public.partner_independent_agreements a
    where a.partner_id=p_partner_id and a.status in ('pending_review','active')
  ) then
    raise exception 'Une convention est déjà en attente ou active pour ce Partenaire' using errcode='23505';
  end if;

  insert into public.partner_independent_agreements(
    partner_id,professional_user_id,template_id,agreement_version,agreement_sha256,
    status,accepted_at,accepted_by
  ) values (
    p_partner_id,v_user,v_template.id,v_template.version,v_template.sha256,
    'pending_review',now(),v_user
  ) returning id into v_agreement_id;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_user,'partner.independent_agreement_accepted','partner_independent_agreement',v_agreement_id::text,
    jsonb_build_object('partner_id',p_partner_id,'template_version',v_template.version,'sha256',v_template.sha256));
  return v_agreement_id;
end;
$function$;

revoke all on function public.partner_independent_agreement_accept(uuid) from public,anon;
grant execute on function public.partner_independent_agreement_accept(uuid) to authenticated;
