-- NAXA — permanence Livreur asymétrique pour les membres du personnel.
-- Un Livreur dédié reste exclusif ; un membre du personnel peut recevoir une
-- affectation Livreur temporaire dans sa pharmacie ou le réseau de son Promoteur.
-- Une mission acceptée reste terminable après l'heure de fin de permanence.
begin;

create or replace function private.naxa_staff_livreur_membership_allowed(
  p_target uuid,
  p_pharmacie uuid,
  p_actor uuid,
  p_commence_at timestamptz,
  p_expire_at timestamptz
) returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select p_target is not null
    and p_actor is not null
    and p_commence_at is not null
    and p_expire_at is not null
    and p_expire_at>p_commence_at
    and exists(select 1 from public.profiles p where p.id=p_target and p.actif=true)
    and exists(select 1 from public.pharmacies ph
      where ph.id=p_pharmacie and ph.actif=true and ph.archivee_le is null)
    and (
      (
        public.naxa_business_function(p_actor)='pharmacie'
        and public.naxa_active_role_pharmacy(p_actor)=p_pharmacie
        and (
          exists(
            select 1
            from public.naxa_professional_assignments a
            join public.pharmacies ph on ph.id=a.pharmacie_id and ph.actif=true and ph.archivee_le is null
            where a.profile_id=p_target
              and a.pharmacie_id=p_pharmacie
              and a.role_code not in ('livreur','client','admin','promoteur','pharmacie')
              and a.statut='active'
              and a.commence_at<p_expire_at
              and (a.expire_at is null or a.expire_at>p_commence_at)
          )
          or exists(
            select 1 from public.profiles p
            where p.id=p_target and p.actif=true
              and p.role::text in ('pharmacie','caisse')
              and p.pharmacie_id=p_pharmacie
          )
        )
      )
      or
      (
        public.naxa_business_function(p_actor)='promoteur'
        and private.naxa_promoteur_valide(p_actor)
        and exists(select 1 from public.promoteur_pharmacies pp
          join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
          where pp.promoteur_id=p_actor and pp.pharmacie_id=p_pharmacie and pp.actif)
        and (
          exists(
            select 1
            from public.naxa_professional_assignments a
            join public.promoteur_pharmacies pp
              on pp.promoteur_id=p_actor and pp.pharmacie_id=a.pharmacie_id and pp.actif
            join public.pharmacies ph on ph.id=a.pharmacie_id and ph.actif=true and ph.archivee_le is null
            where a.profile_id=p_target
              and a.role_code not in ('livreur','client','admin','promoteur','pharmacie')
              and a.statut='active'
              and a.commence_at<p_expire_at
              and (a.expire_at is null or a.expire_at>p_commence_at)
          )
          or exists(
            select 1
            from public.profiles p
            join public.promoteur_pharmacies pp
              on pp.promoteur_id=p_actor and pp.pharmacie_id=p.pharmacie_id and pp.actif
            join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.actif=true and ph.archivee_le is null
            where p.id=p_target and p.actif and p.role::text in ('pharmacie','caisse')
          )
        )
      )
      or
      (
        public.naxa_business_function(p_actor)='admin'
        and (
          exists(
            select 1
            from public.naxa_professional_assignments a
            join public.pharmacies ph on ph.id=a.pharmacie_id and ph.actif=true and ph.archivee_le is null
            where a.profile_id=p_target
              and a.pharmacie_id=p_pharmacie
              and a.role_code not in ('livreur','client','admin','promoteur','pharmacie')
              and a.statut='active'
              and a.commence_at<p_expire_at
              and (a.expire_at is null or a.expire_at>p_commence_at)
          )
          or exists(
            select 1 from public.profiles p
            where p.id=p_target and p.actif=true
              and p.role::text in ('pharmacie','caisse')
              and p.pharmacie_id=p_pharmacie
          )
        )
      )
    )
$function$;
revoke all on function private.naxa_staff_livreur_membership_allowed(uuid,uuid,uuid,timestamptz,timestamptz)
  from public,anon,authenticated;

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
create or replace function private.naxa_business_function(p_profile uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path=''
as $function$
  select coalesce(
    (
      select ar.role_code
      from public.naxa_profile_active_roles ar
      join public.profiles p on p.id=ar.profile_id and p.actif=true
      where ar.profile_id=p_profile
        and (
          (ar.role_code='admin' and p.role::text='admin' and ar.pharmacie_id is null)
          or (ar.role_code='client' and p.role::text='client' and ar.pharmacie_id is null)
          or (ar.role_code='promoteur' and p.role::text='promoteur'
              and ar.pharmacie_id is null and private.naxa_promoteur_valide(p.id))
          or (ar.role_code='pharmacie' and p.role::text='pharmacie'
              and ar.pharmacie_id=p.pharmacie_id
              and exists(select 1 from public.pharmacies ph where ph.id=ar.pharmacie_id and ph.actif))
          or (ar.role_code='caisse' and p.role::text='caisse'
              and ar.pharmacie_id=p.pharmacie_id
              and exists(select 1 from public.pharmacies ph where ph.id=ar.pharmacie_id and ph.actif))
          or exists(
            select 1
            from public.naxa_professional_assignments a
            join public.pharmacies ph on ph.id=a.pharmacie_id and ph.actif=true
            where a.profile_id=p.id
              and a.role_code=ar.role_code
              and a.pharmacie_id=ar.pharmacie_id
              and a.statut='active'
              and a.commence_at<=now()
              and (
                a.expire_at is null
                or a.expire_at>now()
                or (
                  a.role_code='livreur'
                  and exists(select 1 from public.naxa_delivery_missions m
                    where m.livreur_id=p.id and m.pharmacie_id=a.pharmacie_id
                      and m.statut in ('accepted','picked_up','arrived'))
                )
              )
          )
        )
      limit 1
    ),
    (
      select case
        when p.role::text='admin' then 'admin'
        when p.role::text='client' then 'client'
        when p.role::text='promoteur' and private.naxa_promoteur_valide(p.id) then 'promoteur'
        when p.role::text='pharmacie'
          and exists(select 1 from public.pharmacies ph where ph.id=p.pharmacie_id and ph.actif)
          then 'pharmacie'
        when p.role::text='caisse'
          and exists(select 1 from public.pharmacies ph where ph.id=p.pharmacie_id and ph.actif)
          then 'caisse'
        else null
      end
      from public.profiles p
      where p.id=p_profile and p.actif=true
    )
  )
$function$;
revoke all on function private.naxa_business_function(uuid) from public,anon;
grant execute on function private.naxa_business_function(uuid) to authenticated,service_role;

create or replace function public.naxa_select_active_role(
  p_role_code text,
  p_pharmacie_id uuid default null
) returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_profile public.profiles%rowtype;
  v_role public.naxa_roles%rowtype;
  v_allowed boolean:=false;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select * into v_profile from public.profiles where id=v_uid and actif=true for update;
  if not found then raise exception 'Profil actif introuvable'; end if;

  if p_role_code is null then
    delete from public.naxa_profile_active_roles where profile_id=v_uid;
    update public.profiles
      set fonction_interne=null,
          pharmacie_id=case when v_profile.role::text in ('pharmacie','caisse')
            then v_profile.pharmacie_id else null end
    where id=v_uid;
    return true;
  end if;

  select * into v_role from public.naxa_roles where code=p_role_code and actif=true;
  if not found then raise exception 'Rôle inconnu ou inactif'; end if;

  if p_role_code in ('admin','client','promoteur') then
    v_allowed:=v_profile.role::text=p_role_code;
    if p_role_code='promoteur' then
      v_allowed:=v_allowed and private.naxa_promoteur_valide(v_uid);
    end if;
    if p_pharmacie_id is not null then v_allowed:=false; end if;
  elsif p_role_code='pharmacie' and v_profile.role::text='pharmacie' then
    v_allowed:=p_pharmacie_id is not null and p_pharmacie_id=v_profile.pharmacie_id
      and exists(select 1 from public.pharmacies ph where ph.id=p_pharmacie_id and ph.actif=true);
  elsif p_role_code='caisse' and v_profile.role::text='caisse' then
    v_allowed:=p_pharmacie_id is not null and p_pharmacie_id=v_profile.pharmacie_id
      and exists(select 1 from public.pharmacies ph where ph.id=p_pharmacie_id and ph.actif=true);
  else
    v_allowed:=p_pharmacie_id is not null and exists(
      select 1
      from public.naxa_professional_assignments a
      join public.pharmacies ph on ph.id=a.pharmacie_id and ph.actif=true
      where a.profile_id=v_uid
        and a.role_code=p_role_code
        and a.pharmacie_id=p_pharmacie_id
        and a.statut='active'
        and a.commence_at<=now()
        and (
          a.expire_at is null
          or a.expire_at>now()
          or (
            p_role_code='livreur'
            and exists(select 1 from public.naxa_delivery_missions m
              where m.livreur_id=v_uid and m.pharmacie_id=p_pharmacie_id
                and m.statut in ('accepted','picked_up','arrived'))
          )
        )
    );
  end if;

  if not v_allowed then raise exception 'Ce rôle n’est pas attribué à ce compte pour cette pharmacie'; end if;

  insert into public.naxa_profile_active_roles(profile_id,role_code,pharmacie_id,selected_at,updated_at)
  values(v_uid,p_role_code,p_pharmacie_id,now(),now())
  on conflict(profile_id) do update set
    role_code=excluded.role_code,pharmacie_id=excluded.pharmacie_id,
    selected_at=now(),updated_at=now();

  update public.profiles
  set fonction_interne=case when p_role_code in ('admin','client','pharmacie','promoteur') then null else p_role_code end,
      pharmacie_id=case
        when p_role_code in ('admin','client','promoteur') then null
        when p_role_code in ('pharmacie','caisse') then v_profile.pharmacie_id
        else p_pharmacie_id end
  where id=v_uid;
  return true;
end;
$function$;
revoke all on function public.naxa_select_active_role(text,uuid) from public,anon;
grant execute on function public.naxa_select_active_role(text,uuid) to authenticated,service_role;

create or replace function private.naxa_delivery_driver_can_act(p_user uuid,p_mission uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select p_user is not null
    and exists (
      select 1
      from public.naxa_delivery_missions m
      join public.profiles p on p.id=m.livreur_id and p.actif=true
      join public.pharmacies ph on ph.id=m.pharmacie_id and ph.actif=true and ph.archivee_le is null
      join public.naxa_professional_assignments a
        on a.profile_id=m.livreur_id and a.pharmacie_id=m.pharmacie_id
       and a.role_code='livreur' and a.statut='active' and a.commence_at<=now()
       and (
         a.expire_at is null or a.expire_at>now()
         or m.statut in ('accepted','picked_up','arrived')
       )
      where m.id=p_mission and m.livreur_id=p_user
        and public.naxa_business_function(p_user)='livreur'
        and public.naxa_active_role_pharmacy(p_user)=m.pharmacie_id
    )
$function$;
revoke all on function private.naxa_delivery_driver_can_act(uuid,uuid) from public,anon,authenticated;

create or replace function public.naxa_delivery_my_missions(p_include_history boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_pharmacy uuid;
  v_result jsonb;
begin
  if v_uid is null or public.naxa_business_function(v_uid)<>'livreur' then
    raise exception 'Espace Livreur requis';
  end if;
  select public.naxa_active_role_pharmacy(v_uid) into v_pharmacy;
  if v_pharmacy is null
    or not exists(select 1 from public.pharmacies ph where ph.id=v_pharmacy and ph.actif=true and ph.archivee_le is null)
    or (
      not exists(
        select 1 from public.naxa_professional_assignments a
        where a.profile_id=v_uid and a.pharmacie_id=v_pharmacy and a.role_code='livreur'
          and a.statut='active' and a.commence_at<=now()
          and (a.expire_at is null or a.expire_at>now())
      )
      and not exists(
        select 1 from public.naxa_delivery_missions m
        where m.livreur_id=v_uid and m.pharmacie_id=v_pharmacy
          and m.statut in ('accepted','picked_up','arrived')
      )
    ) then
    raise exception 'Affectation Livreur inactive';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',m.id,'reservation_id',m.reservation_id,'statut',m.statut,
    'created_at',m.created_at,'ready_at',m.ready_at,'accepted_at',m.accepted_at,
    'picked_up_at',m.picked_up_at,'arrived_at',m.arrived_at,'delivered_at',m.delivered_at,
    'failure_code',m.failure_code,'failure_note',m.failure_note,
    'commande_statut',r.commande_statut,'total',r.total,'frais_livraison',r.frais_livraison,
    'created_order_at',r.created_at,'ville',r.ville_livraison,'quartier',r.quartier_livraison,
    'adresse',case when m.livreur_id=v_uid then r.adresse_livraison else null end,
    'repere',case when m.livreur_id=v_uid then r.repere_livraison else null end,
    'telephone',case when m.livreur_id=v_uid then r.telephone_livraison else null end,
    'items',case when m.livreur_id=v_uid then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'quantite',ri.quantite,'nom',p.nom,'dosage',p.dosage
      ) order by ri.produit_id),'[]'::jsonb)
      from public.reservation_items ri join public.produits p on p.id=ri.produit_id
      where ri.reservation_id=r.id
    ) else '[]'::jsonb end
  ) order by case when m.statut='available' then 0 else 1 end,m.ready_at),'[]'::jsonb)
  into v_result
  from public.naxa_delivery_missions m
  join public.reservations r on r.id=m.reservation_id
  where m.pharmacie_id=v_pharmacy
    and (
      m.livreur_id=v_uid
      or (
        m.statut='available'
        and exists(
          select 1 from public.naxa_professional_assignments a
          where a.profile_id=v_uid and a.pharmacie_id=v_pharmacy
            and a.role_code='livreur' and a.statut='active'
            and a.commence_at<=now()
            and (a.expire_at is null or a.expire_at>now())
        )
      )
    )
    and (p_include_history or m.statut in ('available','accepted','picked_up','arrived'));
  return v_result;
end;
$function$;
revoke all on function public.naxa_delivery_my_missions(boolean) from public,anon;
grant execute on function public.naxa_delivery_my_missions(boolean) to authenticated,service_role;

commit;
