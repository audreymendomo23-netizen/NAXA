-- NAXA — verrouiller la cohérence des membres et de l’univers avant validation partenaire.
begin;

create or replace function public.admin_valider_dossier_partenaire(p_partner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_universe text;
  v_owner uuid;
  v_partner_type text;
  v_expected_partner_type text;
  v_member_role text;
  v_association_enabled boolean;
  v_rows integer;
begin
  if not public.is_admin() then
    raise exception 'Accès administrateur requis' using errcode='42501';
  end if;
  if p_partner_id is null then
    raise exception 'Dossier partenaire requis' using errcode='22023';
  end if;

  select d.universe_slug, d.promoteur_id, p.partner_type
    into v_universe, v_owner, v_partner_type
  from public.admin_partner_dossiers d
  join public.partners p on p.id=d.partner_id
  where d.partner_id=p_partner_id
    and d.dossier_status='pending'
    and p.status='pending'
  for update of d,p;
  if not found then
    raise exception 'Dossier partenaire introuvable ou déjà traité' using errcode='P0002';
  end if;

  v_expected_partner_type := case v_universe
    when 'parapharmacie' then 'parapharmacie'
    when 'examens' then 'centre_examen'
    when 'prestations' then 'professionnel_domicile'
    when 'aide' then 'autre'
    else null
  end;
  if v_expected_partner_type is null or v_partner_type is distinct from v_expected_partner_type then
    raise exception 'Type de partenaire incohérent avec son univers' using errcode='23514';
  end if;

  if v_universe <> 'aide' and not exists(
    select 1
    from public.universes u
    join public.feature_flags f on f.flag_key='universe.'||u.slug
    where u.slug=v_universe and u.enabled=true and f.enabled=true
  ) then
    raise exception 'Univers inactif' using errcode='23514';
  end if;

  -- Le propriétaire doit toujours être le membre owner du dossier en attente.
  select pm.member_role into v_member_role
  from public.partner_members pm
  where pm.partner_id=p_partner_id
    and pm.user_id=v_owner
  for update;
  if not found or v_member_role is distinct from 'owner' then
    raise exception 'Propriétaire du dossier non rattaché au partenaire' using errcode='23514';
  end if;

  -- L'association créée avec le dossier doit exister et rester désactivée avant validation.
  select pu.enabled into v_association_enabled
  from public.partner_universes pu
  where pu.partner_id=p_partner_id
    and pu.universe_slug=v_universe
  for update;
  if not found then
    raise exception 'Association du partenaire à l’univers absente' using errcode='23514';
  end if;
  if v_association_enabled is distinct from false then
    raise exception 'Association du partenaire déjà active avant validation' using errcode='23514';
  end if;

  update public.partners
  set status='active', verified_at=now(), verified_by=v_actor, updated_at=now()
  where id=p_partner_id;
  if not found then
    raise exception 'Partenaire introuvable pendant la validation' using errcode='P0002';
  end if;

  update public.partner_universes
  set enabled=true
  where partner_id=p_partner_id and universe_slug=v_universe;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Association du partenaire à l’univers non activée' using errcode='23514';
  end if;

  update public.admin_partner_dossiers
  set dossier_status='validated', updated_at=now()
  where partner_id=p_partner_id and dossier_status='pending';
  if not found then
    raise exception 'Dossier partenaire déjà traité' using errcode='P0001';
  end if;

  update public.profiles set actif=true where id=v_owner;
  if not found then
    raise exception 'Compte propriétaire introuvable' using errcode='23503';
  end if;

  insert into public.audit_log(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'partner.dossier_validated','admin_partner_dossier',p_partner_id::text,
    jsonb_build_object('universe_slug',v_universe,'status','active'));
end;
$function$;

revoke all on function public.admin_valider_dossier_partenaire(uuid) from public, anon;
grant execute on function public.admin_valider_dossier_partenaire(uuid) to authenticated;

commit;
