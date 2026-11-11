-- NAXA — appliquer les droits ERP Parapharmacie aux lectures catalogue,
-- mouvements et réservations ; conserver les règles historiques des autres partenaires.
begin;

-- Les mouvements de stock d'une Parapharmacie sont visibles selon le poste actif.
drop policy if exists stock_movements_partner_read on public.stock_movements;
create policy stock_movements_partner_read
on public.stock_movements for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id and pa.status='active'
    where pm.partner_id=stock_movements.partner_id
      and pm.user_id=(select auth.uid())
      and (
        pa.partner_type<>'parapharmacie'
        or private.naxa_partner_actor_can(pa.id,'VIEW_STOCK_MOVEMENTS')
      )
  )
);

-- La provenance photo reste consultable par les rôles ERP habilités.
create policy partner_product_photo_provenance_parapharmacy_read
on public.partner_product_photo_provenance for select to authenticated
using (
  exists (
    select 1
    from public.partner_products pp
    join public.partners pa on pa.id=pp.partner_id and pa.partner_type='parapharmacie'
    where pp.id=partner_product_photo_provenance.product_id
      and pp.partner_id=partner_product_photo_provenance.partner_id
      and pp.universe_slug=partner_product_photo_provenance.universe_slug
      and private.naxa_partner_actor_can(pa.id,'VIEW_PRODUCTS')
  )
);

-- Les réservations suivent le périmètre actif et le privilège de consultation.
drop policy if exists universe_reservations_partner_read on public.universe_reservations;
create policy universe_reservations_partner_read
on public.universe_reservations for select to authenticated
using (
  exists (
    select 1
    from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id and pa.status='active'
    where pm.partner_id=universe_reservations.partner_id
      and pm.user_id=(select auth.uid())
      and (
        pa.partner_type<>'parapharmacie'
        or private.naxa_partner_actor_can(pa.id,'VIEW_RESERVATIONS')
      )
  )
);

-- Ne pas autoriser la suppression d'un produit dans un univers désactivé.
drop policy if exists partner_products_legacy_delete on public.partner_products;
create policy partner_products_legacy_delete
on public.partner_products for delete to authenticated
using (
  exists (
    select 1
    from public.partner_members pm
    join public.partners pa on pa.id=pm.partner_id and pa.status='active'
    join public.partner_universes pu on pu.partner_id=pa.id
      and pu.universe_slug=partner_products.universe_slug and pu.enabled=true
    where pm.partner_id=partner_products.partner_id
      and pm.user_id=(select auth.uid())
      and pa.partner_type<>'parapharmacie'
      and pm.member_role in ('owner','manager','operator')
  )
);

-- L'attribution Livreur reste dans le workflow dédié, comme dans l'ERP Pharmacie.
create or replace function public.naxa_grant_partner_professional_assignment(
  p_target uuid,
  p_partner_id uuid,
  p_fonction text,
  p_commence_at timestamptz,
  p_expire_at timestamptz,
  p_motif text
) returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_actor_role text;
  v_arch text;
  v_max_caisses integer;
  v_count integer;
  v_required_privilege text;
  v_nature text;
  v_id uuid;
begin
  if v_actor is null then raise exception 'Connexion requise'; end if;
  if p_target is null or p_partner_id is null or p_target=v_actor then
    raise exception 'Cible ou partenaire invalide';
  end if;
  if p_fonction='livreur' then
    raise exception 'Le poste Livreur exige un circuit dédié de recrutement, mission et suivi de livraison.';
  end if;
  if not exists (
    select 1 from public.naxa_roles r
    where r.code=p_fonction and r.actif and r.assignable
      and r.categorie='PROFESSIONNEL'
  ) then raise exception 'Rôle professionnel non attribuable'; end if;
  if p_commence_at is null or p_commence_at>now()+interval '1 minute'
    or (p_expire_at is not null and p_expire_at<=greatest(p_commence_at,now())) then
    raise exception 'Période d’affectation invalide';
  end if;
  if p_motif is null or length(trim(p_motif))<5 or length(trim(p_motif))>500 then
    raise exception 'Motif obligatoire (5 à 500 caractères)';
  end if;
  if not exists (select 1 from public.profiles p where p.id=p_target and p.actif=true) then
    raise exception 'Le compte cible doit être actif';
  end if;

  select architecture_code,max_caisses into v_arch,v_max_caisses
  from public.naxa_partner_architectures
  where partner_id=p_partner_id and active=true;
  if v_arch is null or not exists (
    select 1 from public.partners pa
    where pa.id=p_partner_id and pa.partner_type='parapharmacie' and pa.status='active'
  ) then raise exception 'Architecture Parapharmacie absente ou inactive'; end if;

  if p_fonction='responsable' and v_arch not in ('PARENTS_AINES_CADETS','HYBRIDE') then
    raise exception 'Cette architecture ne permet pas de Responsable'; end if;
  if p_fonction='caisse' and not exists (
    select 1 from public.naxa_architecture_niveaux
    where architecture_code=v_arch and niveau=3
  ) then raise exception 'Cette architecture ne permet pas de Caisse'; end if;

  v_actor_role:=public.naxa_business_function(v_actor);
  if not public.is_admin() then
    if v_actor_role not in ('promoteur','responsable')
      or not private.naxa_partner_scope_allows(v_actor,p_partner_id,'PARTENAIRE') then
      raise exception 'Affectation réservée au Promoteur ou Responsable autorisé de cette Parapharmacie';
    end if;
    if v_actor_role='promoteur' then
      if not exists(select 1 from public.partner_members pm
        where pm.partner_id=p_partner_id and pm.user_id=v_actor and pm.member_role='owner') then
        raise exception 'Seul le Promoteur titulaire peut gérer cette équipe';
      end if;
    elsif v_actor_role='responsable' then
      if p_fonction<>'caisse' then
        raise exception 'Le Responsable ne peut affecter que la Caisse';
      end if;
    end if;
  end if;

  v_required_privilege:=case
    when p_fonction='caisse' then 'CREATE_CAISSE'
    when p_fonction='responsable' then 'CREATE_RESPONSABLE'
    else 'ASSIGN_USER_TO_PHARMACY'
  end;
  if not public.is_admin() and not private.naxa_has_partner_privilege(v_required_privilege,p_partner_id) then
    raise exception 'Privilège % absent pour cette Parapharmacie',v_required_privilege;
  end if;

  perform private.naxa_ensure_professional_account_domain(p_target,'PARAPHARMACIE');
  if exists (
    select 1 from public.partner_members pm
    where pm.partner_id=p_partner_id and pm.user_id=p_target and pm.member_role='owner'
  ) then raise exception 'Le Promoteur titulaire ne peut pas être affecté comme membre'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_target::text||':'||p_partner_id::text||':'||p_fonction,0
  ));
  if exists (
    select 1 from public.naxa_partner_professional_assignments a
    where a.profile_id=p_target and a.partner_id=p_partner_id
      and a.role_code=p_fonction and a.statut='active'
      and (a.expire_at is null or a.expire_at>p_commence_at)
      and (p_expire_at is null or a.commence_at<p_expire_at)
  ) then raise exception 'Une affectation active de ce rôle chevauche déjà la période'; end if;

  if p_fonction='caisse' and v_max_caisses is not null then
    perform pg_advisory_xact_lock(hashtextextended('naxa-partner-caisse-quota:'||p_partner_id::text,0));
    select count(*) into v_count
    from public.naxa_partner_professional_assignments a
    join public.profiles p on p.id=a.profile_id and p.actif=true
    where a.partner_id=p_partner_id and a.role_code='caisse'
      and a.statut='active' and a.commence_at<=now()
      and (a.expire_at is null or a.expire_at>now())
      and a.profile_id<>p_target;
    if v_count>=v_max_caisses then raise exception 'Quota Caisses atteint'; end if;
  end if;

  insert into public.partner_members(partner_id,user_id,member_role)
  values(p_partner_id,p_target,'viewer')
  on conflict(partner_id,user_id) do nothing;

  v_nature:=case when p_expire_at is null then 'ordinaire' else 'urgence' end;
  insert into public.naxa_partner_professional_assignments(
    profile_id,partner_id,fonction,role_code,statut,nature_affectation,motif,
    commence_at,expire_at,accorde_par
  ) values(
    p_target,p_partner_id,p_fonction,p_fonction,'active',v_nature,trim(p_motif),
    p_commence_at,p_expire_at,v_actor
  ) returning id into v_id;
  return v_id;
end;
$function$;
revoke all on function public.naxa_grant_partner_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.naxa_grant_partner_professional_assignment(uuid,uuid,text,timestamptz,timestamptz,text) to authenticated,service_role;

commit;
