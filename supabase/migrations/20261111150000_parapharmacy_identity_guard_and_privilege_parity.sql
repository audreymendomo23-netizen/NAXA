-- NAXA — verrouiller l'identité professionnelle et les droits d'import Parapharmacie.
begin;

-- Sérialiser l'affectation d'un domaine, y compris lors de deux créations concurrentes.
create or replace function private.naxa_ensure_professional_account_domain(
  p_profile uuid,
  p_domain text
) returns void
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_existing text;
  v_base_role text;
begin
  if p_profile is null or p_domain not in ('PHARMACIE','PARAPHARMACIE') then
    raise exception 'Domaine professionnel invalide';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_profile::text,0));

  select role::text into v_base_role
  from public.profiles where id=p_profile;
  if not found then raise exception 'Profil professionnel introuvable'; end if;

  select domain_code into v_existing
  from public.naxa_professional_account_domains
  where profile_id=p_profile;
  if v_existing is not null then
    if v_existing<>p_domain then
      raise exception 'Ce compte professionnel est déjà rattaché à un autre domaine NAXA';
    end if;
    return;
  end if;

  if p_domain='PARAPHARMACIE' then
    if v_base_role in ('admin','pharmacie','caisse','promoteur')
      or exists(select 1 from public.naxa_professional_assignments a where a.profile_id=p_profile)
      or exists(select 1 from public.promoteur_pharmacies pp where pp.promoteur_id=p_profile)
      or exists(select 1 from public.naxa_profile_active_roles ar
        where ar.profile_id=p_profile and ar.pharmacie_id is not null) then
      raise exception 'Un compte professionnel Pharmacie ne peut pas être réutilisé en Parapharmacie';
    end if;
  else
    if exists (
      select 1 from public.partner_members pm
      join public.partners pa on pa.id=pm.partner_id
      where pm.user_id=p_profile and pa.partner_type='parapharmacie'
    ) or exists (
      select 1 from public.naxa_partner_professional_assignments a
      where a.profile_id=p_profile
    ) then
      raise exception 'Un compte professionnel Parapharmacie ne peut pas être réutilisé en Pharmacie';
    end if;
  end if;

  insert into public.naxa_professional_account_domains(profile_id,domain_code)
  values(p_profile,p_domain);
end;
$function$;
revoke all on function private.naxa_ensure_professional_account_domain(uuid,text) from public,anon,authenticated;

-- Le profil doit d'abord exister : AFTER INSERT/UPDATE, et non BEFORE INSERT.
create or replace function private.naxa_guard_profile_professional_domain()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if new.role::text in ('pharmacie','caisse','promoteur') then
    perform private.naxa_ensure_professional_account_domain(new.id,'PHARMACIE');
  end if;
  return new;
end;
$function$;
drop trigger if exists naxa_profile_professional_domain_guard on public.profiles;
create trigger naxa_profile_professional_domain_guard
after insert or update of role on public.profiles
for each row execute function private.naxa_guard_profile_professional_domain();

-- L'import CSV crée des produits et initialise leur stock :
-- il doit respecter la matrice NAXA ET les délégations des deux droits existants.
-- Ne pas créer un faux privilège IMPORT_PRODUCTS et ne pas s'appeler récursivement.
create or replace function private.naxa_has_partner_privilege(
  p_privilege text,
  p_partner uuid
) returns boolean
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_role text;
  v_architecture text;
begin
  if auth.uid() is null or p_privilege is null or p_partner is null then
    return false;
  end if;
  if public.is_admin() then return true; end if;

  v_role:=private.naxa_partner_business_function(auth.uid());
  if v_role is null
    or not private.naxa_partner_scope_allows(auth.uid(),p_partner,'PARTENAIRE') then
    return false;
  end if;

  select architecture_code into v_architecture
  from public.naxa_partner_architectures
  where partner_id=p_partner and active=true;
  if v_architecture is null then return false; end if;

  if p_privilege='IMPORT_PRODUCTS' then
    if v_role not in ('promoteur','responsable') then return false; end if;

    return
      exists (
        select 1
        from public.naxa_architecture_privileges ap
        join public.naxa_profile_active_roles ar
          on ar.profile_id=auth.uid() and ar.partner_id=p_partner and ar.role_code=v_role
        join public.naxa_profile_privileges pp
          on pp.profile_id=auth.uid() and pp.partner_id=p_partner
          and pp.scope_type='PARTENAIRE' and pp.privilege_code='CREATE_PRODUCT'
          and pp.active=true and pp.revoked_at is null
        where ap.architecture_code=v_architecture
          and ap.role_key=v_role and ap.privilege_code='CREATE_PRODUCT'
      )
      and exists (
        select 1
        from public.naxa_architecture_privileges ap
        join public.naxa_profile_active_roles ar
          on ar.profile_id=auth.uid() and ar.partner_id=p_partner and ar.role_code=v_role
        join public.naxa_profile_privileges pp
          on pp.profile_id=auth.uid() and pp.partner_id=p_partner
          and pp.scope_type='PARTENAIRE' and pp.privilege_code='IMPORT_STOCK'
          and pp.active=true and pp.revoked_at is null
        where ap.architecture_code=v_architecture
          and ap.role_key=v_role and ap.privilege_code='IMPORT_STOCK'
      );
  end if;

  -- Droits opérationnels historiques Stock : limités à ces postes et actions.
  if v_role in ('pharmacien','gestionnaire_stock','magasinier')
    and p_privilege in (
      'VIEW_PRODUCTS','VIEW_STOCK','EDIT_STOCK_QUANTITY',
      'VIEW_STOCK_MOVEMENTS','VIEW_STOCK_ANOMALIES','MANAGE_STOCK_ANOMALIES',
      'VIEW_LOTS','MANAGE_LOTS','VIEW_EXPIRATION','MANAGE_EXPIRATION',
      'VIEW_STOCK_KPI','VIEW_ALERT_KPI'
    ) then
    return true;
  end if;

  return exists (
    select 1
    from public.naxa_architecture_privileges ap
    join public.naxa_profile_active_roles ar
      on ar.profile_id=auth.uid() and ar.partner_id=p_partner
    join public.naxa_profile_privileges pp
      on pp.profile_id=auth.uid()
      and pp.partner_id=p_partner
      and pp.scope_type='PARTENAIRE'
      and pp.privilege_code=p_privilege
      and pp.active=true
      and pp.revoked_at is null
    where ap.architecture_code=v_architecture
      and ap.role_key=v_role
      and ap.privilege_code=p_privilege
      and ar.role_code=v_role
  );
end;
$function$;

revoke all on function private.naxa_has_partner_privilege(text,uuid) from public,anon;
grant execute on function private.naxa_has_partner_privilege(text,uuid) to authenticated,service_role;

commit;
