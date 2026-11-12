-- NAXA — préserver les affectations Livreur simultanées dans plusieurs pharmacies.
-- Un compte peut couvrir plusieurs pharmacies ; son espace actif et ses missions
-- restent strictement limités à la pharmacie sélectionnée.
begin;

create or replace function private.naxa_livreur_assignment_exclusivity()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_profile_role text;
begin
  if new.statut<>'active' then return new; end if;

  select p.role::text into v_profile_role
  from public.profiles p where p.id=new.profile_id and p.actif=true;
  if v_profile_role is null then raise exception 'Le compte cible doit être actif'; end if;

  if new.role_code='livreur' then
    -- Profil Livreur dédié : compte Client, permanent et sans autre poste.
    if new.nature_affectation='ordinaire' and new.expire_at is null then
      if v_profile_role<>'client' then
        raise exception 'Un Livreur dédié doit conserver une identité de base Client';
      end if;
      if exists(
        select 1 from public.naxa_professional_assignments a
        where a.profile_id=new.profile_id and a.id is distinct from new.id
          and a.role_code<>'livreur' and a.statut='active'
          and a.commence_at<coalesce(new.expire_at,'infinity'::timestamptz)
          and (a.expire_at is null or a.expire_at>new.commence_at)
      ) then
        raise exception 'Un Livreur dédié ne peut pas recevoir un autre poste professionnel';
      end if;
    -- Permanence Livreur : affectation temporaire d'un membre déjà rattaché.
    elsif new.nature_affectation='urgence' and new.expire_at is not null then
      if not private.naxa_staff_livreur_membership_allowed(
        new.profile_id,new.pharmacie_id,new.accorde_par,new.commence_at,new.expire_at
      ) then
        raise exception 'La permanence Livreur est réservée à un membre actif de cette pharmacie ou du même réseau Promoteur';
      end if;
    else
      raise exception 'Un poste Livreur doit être permanent pour un profil dédié ou temporaire pour une permanence du personnel';
    end if;

    if exists(
      select 1 from public.naxa_professional_assignments a
      where a.profile_id=new.profile_id and a.id is distinct from new.id
        and a.pharmacie_id=new.pharmacie_id
        and a.role_code='livreur' and a.statut='active'
        and a.commence_at<coalesce(new.expire_at,'infinity'::timestamptz)
        and (a.expire_at is null or a.expire_at>new.commence_at)
    ) then
      raise exception 'Une autre affectation Livreur chevauche déjà cette permanence';
    end if;

  elsif exists(
    select 1 from public.naxa_professional_assignments a
    where a.profile_id=new.profile_id and a.id is distinct from new.id
      and a.role_code='livreur'
      and a.nature_affectation='ordinaire'
      and a.expire_at is null
      and a.statut='active'
      and a.commence_at<coalesce(new.expire_at,'infinity'::timestamptz)
      and (a.expire_at is null or a.expire_at>new.commence_at)
  ) then
    raise exception 'Un profil Livreur dédié ne peut pas recevoir un autre poste professionnel';
  end if;

  return new;
end;
$function$;

create or replace function public.naxa_grant_livreur_assignment(
  p_target uuid,
  p_pharmacie uuid,
  p_commence_at timestamptz,
  p_expire_at timestamptz default null,
  p_motif text default 'Affectation Livreur'
) returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_actor_role text;
  v_target_role text;
  v_id uuid;
begin
  if v_actor is null then raise exception 'Connexion requise'; end if;
  if p_target is null or p_pharmacie is null or p_target=v_actor then
    raise exception 'Compte cible ou pharmacie invalide';
  end if;
  if p_commence_at is null
    or (p_expire_at is not null and p_expire_at<=p_commence_at) then
    raise exception 'Période d’affectation invalide';
  end if;
  if p_motif is null or length(trim(p_motif))<5 or length(trim(p_motif))>500 then
    raise exception 'Motif obligatoire (5 à 500 caractères)';
  end if;

  select p.role::text into v_target_role
  from public.profiles p
  join auth.users u on u.id=p.id
  where p.id=p_target
    and p.actif=true
    and p.age_verified=true
    and p.consent_accepted_at is not null
    and p.username is not null
    and p.first_name is not null
    and p.last_name is not null
    and p.phone is not null
    and p.date_of_birth is not null
    and p.date_of_birth<=(current_date-interval '18 years')::date
    and u.email_confirmed_at is not null;
  if v_target_role is null then
    raise exception 'Le compte cible doit être actif, majeur, complet, consentant et avec e-mail confirmé';
  end if;

  if not exists(select 1 from public.pharmacies ph
    where ph.id=p_pharmacie and ph.actif=true and ph.archivee_le is null) then
    raise exception 'Pharmacie inactive ou introuvable';
  end if;

  v_actor_role:=public.naxa_business_function(v_actor);
  if public.is_admin() then
    null;
  elsif v_actor_role='promoteur' then
    if not private.naxa_promoteur_valide(v_actor)
      or not exists(select 1 from public.promoteur_pharmacies pp
        where pp.promoteur_id=v_actor and pp.pharmacie_id=p_pharmacie and pp.actif) then
      raise exception 'Pharmacie hors réseau du Promoteur';
    end if;
    if not public.naxa_has_privilege('ASSIGN_USER_TO_PHARMACY',p_pharmacie,'PHARMACIE') then
      raise exception 'Privilège ASSIGN_USER_TO_PHARMACY absent';
    end if;
  elsif v_actor_role='pharmacie'
    and public.naxa_active_role_pharmacy(v_actor)=p_pharmacie
    and public.naxa_scope_allows(v_actor,p_pharmacie,'PHARMACIE') then
    null;
  else
    raise exception 'Seul le Promoteur du réseau ou le compte Pharmacie concerné peut affecter un Livreur';
  end if;

  if p_expire_at is null then
    if v_target_role<>'client' then
      raise exception 'Un Livreur dédié doit être un profil Client autonome ; pour un membre du personnel, créez une permanence temporaire';
    end if;
    if exists(
      select 1 from public.naxa_professional_assignments a
      where a.profile_id=p_target and a.role_code<>'livreur'
        and a.statut='active'
        and a.commence_at<coalesce(p_expire_at,'infinity'::timestamptz)
        and (a.expire_at is null or a.expire_at>p_commence_at)
    ) then
      raise exception 'Ce compte possède déjà un poste professionnel : utilisez une permanence Livreur temporaire';
    end if;
  else
    if not private.naxa_staff_livreur_membership_allowed(
      p_target,p_pharmacie,v_actor,p_commence_at,p_expire_at
    ) then
      raise exception 'Le candidat à la permanence doit déjà appartenir à cette pharmacie ou à une pharmacie du même réseau Promoteur';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_target::text||':livreur',0));
  if exists(
    select 1 from public.naxa_professional_assignments a
    where a.profile_id=p_target
      and a.pharmacie_id=p_pharmacie
      and a.role_code='livreur'
      and a.statut='active'
      and a.commence_at<p_expire_at
      and (a.expire_at is null or a.expire_at>p_commence_at)
  ) then
    raise exception 'Une autre affectation Livreur chevauche déjà cette période';
  end if;

  insert into public.naxa_professional_assignments(
    profile_id,pharmacie_id,fonction,role_code,statut,nature_affectation,motif,
    commence_at,expire_at,accorde_par
  ) values(
    p_target,p_pharmacie,'livreur','livreur','active',
    case when p_expire_at is null then 'ordinaire' else 'urgence' end,
    trim(p_motif),p_commence_at,p_expire_at,v_actor
  ) returning id into v_id;

  return v_id;
end;
$function$;
revoke all on function public.naxa_grant_livreur_assignment(uuid,uuid,timestamptz,timestamptz,text) from public,anon;
grant execute on function public.naxa_grant_livreur_assignment(uuid,uuid,timestamptz,timestamptz,text) to authenticated;

-- L'espace Livreur reste accessible après expiration uniquement pour terminer
-- une mission déjà acceptée ; la prise de nouvelles missions reste impossible.

commit;
