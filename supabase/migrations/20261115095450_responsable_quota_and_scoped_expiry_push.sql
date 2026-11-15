-- Enforce the Promoteur-defined Responsable ceiling and support a scoped
-- server-side push retry for one notification without claiming unrelated rows.

create or replace function public.naxa_grant_professional_assignment(
  p_target uuid,
  p_pharmacie uuid,
  p_fonction text,
  p_commence_at timestamp with time zone,
  p_expire_at timestamp with time zone,
  p_motif text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_actor_role text;
  v_id uuid;
  v_arch text;
  v_max_caisses integer;
  v_max_responsables integer;
  v_count integer;
  v_required_privilege text;
  v_nature text;
begin
  if v_actor is null then raise exception 'Connexion requise'; end if;
  if p_target is null or p_pharmacie is null or p_target=v_actor then
    raise exception 'Cible ou pharmacie invalide';
  end if;
  if not exists(select 1 from public.naxa_roles r
    where r.code=p_fonction and r.actif and r.assignable and r.portee='PHARMACIE') then
    raise exception 'Rôle professionnel non attribuable';
  end if;
  if p_commence_at is null or p_commence_at>now()+interval '1 minute'
     or (p_expire_at is not null and p_expire_at<=greatest(p_commence_at,now())) then
    raise exception 'Période d’affectation invalide';
  end if;
  if p_motif is null or length(trim(p_motif))<5 or length(trim(p_motif))>500 then
    raise exception 'Motif obligatoire (5 à 500 caractères)';
  end if;
  if not exists(select 1 from public.profiles p where p.id=p_target and p.actif=true) then
    raise exception 'Le compte cible doit être actif';
  end if;
  if not exists(select 1 from public.pharmacies ph where ph.id=p_pharmacie and ph.actif=true) then
    raise exception 'Pharmacie inactive ou introuvable';
  end if;

  v_actor_role:=private.naxa_business_function(v_actor);
  if not public.is_admin() then
    if v_actor_role not in ('promoteur','responsable') then
      raise exception 'Affectation réservée au Promoteur ou Responsable autorisé';
    end if;
    if v_actor_role='promoteur' then
      if not private.naxa_promoteur_valide(v_actor)
         or not exists(select 1 from public.promoteur_pharmacies pp
           where pp.promoteur_id=v_actor and pp.pharmacie_id=p_pharmacie and pp.actif) then
        raise exception 'Pharmacie hors réseau Promoteur ou Promoteur invalide';
      end if;
    elsif v_actor_role='responsable' then
      if p_fonction<>'caisse'
         or not exists(select 1 from public.profiles p where p.id=v_actor and p.pharmacie_id=p_pharmacie) then
        raise exception 'Le Responsable ne peut affecter que la Caisse de sa pharmacie';
      end if;
    end if;
  end if;

  v_required_privilege:=case
    when p_fonction='caisse' then 'CREATE_CAISSE'
    when p_fonction='responsable' then 'CREATE_RESPONSABLE'
    else 'ASSIGN_USER_TO_PHARMACY'
  end;
  if not public.is_admin() then
    if p_fonction='responsable' then
      if not public.naxa_has_privilege(v_required_privilege,p_pharmacie,'PHARMACIE') then
        raise exception 'Privilège CREATE_RESPONSABLE absent';
      end if;
    elsif p_fonction='caisse' then
      if not public.naxa_can('CREATE_CAISSE',p_pharmacie,null) then
        raise exception 'Privilège CREATE_CAISSE absent';
      end if;
    elsif not public.naxa_has_privilege(v_required_privilege,p_pharmacie,'PHARMACIE') then
      raise exception 'Privilège ASSIGN_USER_TO_PHARMACY absent';
    end if;
  end if;

  select architecture_code,max_caisses,max_responsables
    into v_arch,v_max_caisses,v_max_responsables
  from public.pharmacie_architectures
  where pharmacie_id=p_pharmacie and active=true;
  if v_arch is null then raise exception 'Architecture non définie'; end if;
  if p_fonction='responsable' and v_arch not in ('PARENTS_AINES_CADETS','HYBRIDE') then
    raise exception 'Cette architecture ne permet pas de Responsable';
  end if;
  if p_fonction='caisse' and not exists(select 1 from public.naxa_architecture_niveaux
    where architecture_code=v_arch and niveau=3) then
    raise exception 'Cette architecture ne permet pas de Caisse';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_target::text||':'||p_pharmacie::text||':'||p_fonction,0));

  if exists(select 1 from public.naxa_professional_assignments a
    where a.profile_id=p_target and a.pharmacie_id=p_pharmacie
      and a.role_code=p_fonction and a.statut='active'
      and (a.expire_at is null or a.expire_at>p_commence_at)
      and (p_expire_at is null or a.commence_at<p_expire_at)) then
    raise exception 'Une affectation active de ce rôle chevauche déjà la période';
  end if;

  if p_fonction='responsable' then
    -- Serialize Responsable grants per pharmacy: two Promoters cannot consume
    -- the final available slot concurrently.
    perform pg_advisory_xact_lock(
      hashtextextended('naxa-responsable-quota:'||p_pharmacie::text,0)
    );
    select count(*) into v_count
    from public.naxa_professional_assignments a
    join public.profiles p on p.id=a.profile_id and p.actif=true
    where a.pharmacie_id=p_pharmacie and a.role_code='responsable'
      and a.statut='active' and a.commence_at<=now()
      and (a.expire_at is null or a.expire_at>now());
    if v_count>=coalesce(v_max_responsables,0) then
      raise exception 'Quota Responsables atteint';
    end if;
  end if;

  if p_fonction='caisse' and v_max_caisses is not null then
    perform pg_advisory_xact_lock(hashtextextended('naxa-caisse-quota:'||p_pharmacie::text,0));
    select count(*) into v_count
    from public.naxa_professional_assignments a
    join public.profiles p on p.id=a.profile_id and p.actif=true
    where a.pharmacie_id=p_pharmacie and a.role_code='caisse'
      and a.statut='active' and a.commence_at<=now()
      and (a.expire_at is null or a.expire_at>now())
      and a.profile_id<>p_target;
    if v_count>=v_max_caisses then raise exception 'Quota Caisses atteint'; end if;
  end if;

  v_nature:=case when p_expire_at is null then 'ordinaire' else 'urgence' end;
  insert into public.naxa_professional_assignments(
    profile_id,pharmacie_id,fonction,role_code,statut,nature_affectation,motif,
    commence_at,expire_at,accorde_par
  ) values(
    p_target,p_pharmacie,p_fonction,p_fonction,'active',v_nature,trim(p_motif),
    p_commence_at,p_expire_at,v_actor
  ) returning id into v_id;

  return v_id;
end
$function$;

revoke all on function public.naxa_grant_professional_assignment(uuid,uuid,text,timestamp with time zone,timestamp with time zone,text)
  from public,anon;
grant execute on function public.naxa_grant_professional_assignment(uuid,uuid,text,timestamp with time zone,timestamp with time zone,text)
  to authenticated,service_role;

create or replace function public.claim_notification_push_outbox_for_notification(
  p_notification_id uuid
)
returns table(
  outbox_id uuid,
  notification_id uuid,
  user_id uuid,
  title text,
  body text,
  notification_type text,
  attempt_count integer
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if p_notification_id is null then
    raise exception 'Identifiant de notification requis';
  end if;

  update private.notification_push_outbox o
  set status='dead',locked_at=null,last_error='Compte destinataire inactif'
  where o.notification_id=p_notification_id
    and o.status in ('pending','processing')
    and not exists (
      select 1 from public.profiles p
      where p.id=o.recipient_user_id and p.actif=true
    );

  return query
  with candidates as (
    select o.id
    from private.notification_push_outbox o
    where o.notification_id=p_notification_id
      and (
        (o.status='pending' and o.next_attempt_at<=now())
        or (o.status='processing' and o.locked_at<now()-interval '5 minutes')
      )
    order by o.created_at,o.id
    for update skip locked
    limit 100
  ), claimed as (
    update private.notification_push_outbox o
    set status='processing',locked_at=now(),attempt_count=o.attempt_count+1,last_error=null
    from candidates c where o.id=c.id
    returning o.id,o.notification_id,o.recipient_user_id,o.attempt_count
  )
  select c.id,n.id,c.recipient_user_id,n.titre,n.corps,n.type,c.attempt_count
  from claimed c
  join public.notifications n on n.id=c.notification_id
  join public.profiles p on p.id=c.recipient_user_id and p.actif=true;
end
$function$;

revoke all on function public.claim_notification_push_outbox_for_notification(uuid)
  from public,anon,authenticated;
grant execute on function public.claim_notification_push_outbox_for_notification(uuid) to service_role;

create or replace function public.naxa_dispatch_pharmacy_lot_expiry_alerts_internal(
  p_today date,
  p_limit integer default 1000
)
returns integer
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if coalesce(auth.role(),'')<>'service_role' then
    raise insufficient_privilege using message='Réservé au service NAXA';
  end if;
  if p_today is null or p_limit is null or p_limit<1 or p_limit>5000 then
    raise exception 'Paramètres de distribution péremption invalides';
  end if;
  return private.dispatch_pharmacy_lot_expiry_alerts(p_today,p_limit);
end
$function$;

revoke all on function public.naxa_dispatch_pharmacy_lot_expiry_alerts_internal(date,integer)
  from public,anon,authenticated;
grant execute on function public.naxa_dispatch_pharmacy_lot_expiry_alerts_internal(date,integer)
  to service_role;
