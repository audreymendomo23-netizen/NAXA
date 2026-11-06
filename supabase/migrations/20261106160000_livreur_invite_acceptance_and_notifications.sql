-- NAXA — idempotence des notifications et acceptation d'invitation compatible avec l'auth du bénéficiaire.
begin;

create or replace function public.naxa_accept_livreur_invite(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_email text;
  v_confirmed timestamptz;
  v_invite public.naxa_livreur_invites%rowtype;
  v_role text;
  v_assignment uuid;
begin
  if v_uid is null then raise exception 'Connectez-vous au compte qui recevra le poste Livreur'; end if;
  select lower(u.email),u.email_confirmed_at into v_email,v_confirmed
  from auth.users u where u.id=v_uid;
  if v_email is null or v_confirmed is null then
    raise exception 'Confirmez l’adresse e-mail de votre compte avant d’accepter l’invitation';
  end if;

  select * into v_invite from public.naxa_livreur_invites
  where token=p_token for update;
  if not found or v_invite.revoked_at is not null or v_invite.accepted_at is not null
    or v_invite.expires_at<=now() or v_invite.email<>v_email then
    raise exception 'Invitation invalide, expirée, déjà utilisée ou destinée à une autre adresse';
  end if;
  if not exists(
    select 1 from public.profiles p where p.id=v_uid and p.role::text='client'
      and p.actif=true and p.age_verified=true and p.consent_accepted_at is not null
      and p.username is not null and p.first_name is not null and p.last_name is not null
      and p.phone is not null and p.date_of_birth is not null
  ) then
    raise exception 'Finalisez d’abord votre compte Client et les vérifications obligatoires NAXA';
  end if;
  if not exists(select 1 from public.pharmacies p where p.id=v_invite.pharmacie_id and p.actif=true and p.archivee_le is null) then
    raise exception 'La pharmacie a été suspendue ou archivée';
  end if;

  v_role:=public.naxa_business_function(v_invite.inviteur_id);
  if v_role='promoteur' then
    if not private.naxa_promoteur_valide(v_invite.inviteur_id)
      or not exists(select 1 from public.promoteur_pharmacies pp
        where pp.promoteur_id=v_invite.inviteur_id and pp.pharmacie_id=v_invite.pharmacie_id and pp.actif) then
      raise exception 'L’autorisation du Promoteur a changé : demandez une nouvelle invitation';
    end if;
  elsif v_role='pharmacie' then
    if public.naxa_active_role_pharmacy(v_invite.inviteur_id) is distinct from v_invite.pharmacie_id
      or not public.naxa_scope_allows(v_invite.inviteur_id,v_invite.pharmacie_id,'PHARMACIE') then
      raise exception 'L’autorisation de la Pharmacie a changé : demandez une nouvelle invitation';
    end if;
  else
    raise exception 'Le compte ayant émis l’invitation n’est plus autorisé';
  end if;

  if exists(
    select 1 from public.naxa_professional_assignments a
    where a.profile_id=v_uid and a.statut='active'
      and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now())
      and a.role_code<>'livreur'
  ) then
    raise exception 'Votre compte possède déjà un autre poste professionnel ; un compte Livreur doit rester exclusif';
  end if;

  insert into public.naxa_professional_assignments(
    profile_id,pharmacie_id,fonction,role_code,statut,nature_affectation,motif,
    commence_at,expire_at,accorde_par
  ) values(
    v_uid,v_invite.pharmacie_id,'livreur','livreur','active','ordinaire',
    'Invitation Livreur acceptée par le titulaire du compte',now(),null,v_invite.inviteur_id
  ) returning id into v_assignment;

  update public.naxa_livreur_invites
  set accepted_at=now(),accepted_by=v_uid,assignment_id=v_assignment
  where token=p_token;

  perform public.naxa_select_active_role('livreur',v_invite.pharmacie_id);

  insert into public.notifications(user_id,pharmacie_id,type,titre,corps,related_entity_id)
  values(v_uid,v_invite.pharmacie_id,'professional_assignment','Poste Livreur activé',
    'Votre compte Livreur est actif. Vous pouvez ouvrir votre tableau de bord NAXA.',v_assignment);

  return jsonb_build_object('accepted',true,'role','livreur','pharmacie_id',v_invite.pharmacie_id,'assignment_id',v_assignment);
end;
$function$;
revoke all on function public.naxa_accept_livreur_invite(uuid) from public,anon;
grant execute on function public.naxa_accept_livreur_invite(uuid) to authenticated;

create or replace function public.naxa_revoke_livreur_invite(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_invite public.naxa_livreur_invites%rowtype;
  v_role text;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select * into v_invite from public.naxa_livreur_invites where token=p_token for update;
  if not found or v_invite.accepted_at is not null or v_invite.revoked_at is not null then
    raise exception 'Invitation en attente introuvable';
  end if;
  if v_uid<>v_invite.inviteur_id and not public.is_admin() then
    raise exception 'Seul l’émetteur de l’invitation peut la révoquer';
  end if;
  v_role:=public.naxa_business_function(v_uid);
  if not public.is_admin() and v_role not in ('promoteur','pharmacie') then
    raise exception 'Droit de révocation absent';
  end if;
  update public.naxa_livreur_invites set revoked_at=now() where token=p_token;
  return true;
end;
$function$;
revoke all on function public.naxa_revoke_livreur_invite(uuid) from public,anon;
grant execute on function public.naxa_revoke_livreur_invite(uuid) to authenticated;

-- Le trigger delivery_client_notification est l'unique producteur de notification Client.
create or replace function public.naxa_delivery_arrived(
  p_mission uuid,p_latitude double precision default null,p_longitude double precision default null
) returns boolean
language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
begin
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if v_uid is null or not found or not private.naxa_delivery_driver_can_act(v_uid,p_mission)
    or v_m.statut<>'picked_up' then
    raise exception 'Le livreur actif doit avoir récupéré la commande avant de signaler son arrivée';
  end if;
  if (p_latitude is null)<>(p_longitude is null)
    or (p_latitude is not null and (p_latitude not between -90 and 90 or p_longitude not between -180 and 180)) then
    raise exception 'Position GPS invalide';
  end if;
  update public.naxa_delivery_missions set statut='arrived',arrived_at=now(),updated_at=now() where id=p_mission;
  insert into public.naxa_delivery_events(
    mission_id,reservation_id,pharmacie_id,actor_id,event_type,label,latitude,longitude
  ) values(p_mission,v_m.reservation_id,v_m.pharmacie_id,v_uid,'arrived','Livreur arrivé à destination',p_latitude,p_longitude);
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_arrived(uuid,double precision,double precision) from public,anon;
grant execute on function public.naxa_delivery_arrived(uuid,double precision,double precision) to authenticated;

create or replace function public.naxa_delivery_report_issue(p_mission uuid,p_code text,p_note text default null)
returns boolean
language plpgsql security definer set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
begin
  if p_code not in ('client_absent','adresse_introuvable','client_injoignable','incident_route','commande_endommagee','autre')
    or length(coalesce(p_note,''))>500 then raise exception 'Motif de difficulté invalide'; end if;
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if v_uid is null or not found or not private.naxa_delivery_driver_can_act(v_uid,p_mission)
    or v_m.statut not in ('accepted','picked_up','arrived') then
    raise exception 'Cette mission ne peut pas recevoir de signalement';
  end if;
  update public.naxa_delivery_missions
  set statut='failed',failed_at=now(),failure_code=p_code,failure_note=nullif(trim(p_note),''),updated_at=now()
  where id=p_mission;
  insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label,detail)
  values(p_mission,v_m.reservation_id,v_m.pharmacie_id,v_uid,'failed','Incident de livraison signalé',
    jsonb_build_object('code',p_code,'note',nullif(trim(p_note),''))::text);
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_report_issue(uuid,text,text) from public,anon;
grant execute on function public.naxa_delivery_report_issue(uuid,text,text) to authenticated;

commit;
