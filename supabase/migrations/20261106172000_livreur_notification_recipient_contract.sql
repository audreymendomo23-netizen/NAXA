-- NAXA — aligner les notifications de livraison sur le contrat exclusif de destinataire.
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

  insert into public.notifications(user_id,type,titre,corps,related_entity_id)
  values(v_uid,'professional_assignment','Poste Livreur activé',
    'Votre compte Livreur est actif. Vous pouvez ouvrir votre tableau de bord NAXA.',v_assignment);

  return jsonb_build_object('accepted',true,'role','livreur','pharmacie_id',v_invite.pharmacie_id,'assignment_id',v_assignment);
end;
$function$;
revoke all on function public.naxa_accept_livreur_invite(uuid) from public,anon;
grant execute on function public.naxa_accept_livreur_invite(uuid) to authenticated;

create or replace function public.naxa_delivery_make_available(p_reservation uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_role text;
  v_r public.reservations%rowtype;
  v_m public.naxa_delivery_missions%rowtype;
  v_mission uuid;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;
  select * into v_r from public.reservations where id=p_reservation for update;
  if not found or v_r.mode<>'commande' then raise exception 'Commande de livraison introuvable'; end if;
  if not public.naxa_scope_allows(v_uid,v_r.pharmacie_id,'PHARMACIE') then
    raise exception 'Commande hors périmètre pharmacie';
  end if;
  v_role:=public.naxa_business_function(v_uid);
  if not public.is_admin() and v_role not in ('gestionnaire_stock','magasinier') then
    raise exception 'Seul le poste Gestionnaire de stock ou Magasinier peut publier une livraison prête';
  end if;
  if v_r.commande_statut<>'preparation'
    or v_r.preparation_statut<>'prete_au_retrait'
    or v_r.statut in ('annulee','expiree','retiree') then
    raise exception 'Stock doit avoir enregistré la préparation puis confirmé Prête pour livraison';
  end if;

  select * into v_m from public.naxa_delivery_missions where reservation_id=p_reservation for update;
  if found then
    if v_m.statut='cancelled' then raise exception 'Cette commande a été annulée et ne peut plus être republiée'; end if;
    if v_m.statut='failed' then raise exception 'Cette mission doit être réaffectée par la pharmacie avant une nouvelle publication'; end if;
    return v_m.id;
  end if;

  insert into public.naxa_delivery_missions(reservation_id,pharmacie_id,client_id,ready_by)
  values(v_r.id,v_r.pharmacie_id,v_r.client_id,v_uid)
  returning id into v_mission;

  insert into public.naxa_delivery_events(
    mission_id,reservation_id,pharmacie_id,actor_id,event_type,label
  ) values(v_mission,v_r.id,v_r.pharmacie_id,v_uid,'ready','Préparation Stock terminée · commande publiée pour livraison');

  insert into public.naxa_delivery_mission_offers(mission_id,reservation_id,pharmacie_id,livreur_id)
  select v_mission,v_r.id,v_r.pharmacie_id,a.profile_id
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id and p.actif=true
  where a.pharmacie_id=v_r.pharmacie_id and a.role_code='livreur' and a.statut='active'
    and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now());

  insert into public.notifications(user_id,type,titre,corps,reservation_id,related_entity_id)
  select distinct a.profile_id,'delivery_mission','Nouvelle livraison disponible',
    'Une commande préparée attend un livreur dans votre pharmacie.',v_r.id,v_mission
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id and p.actif=true
  where a.pharmacie_id=v_r.pharmacie_id and a.role_code='livreur' and a.statut='active'
    and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now());

  return v_mission;
end;
$function$;
revoke all on function public.naxa_delivery_make_available(uuid) from public,anon;
grant execute on function public.naxa_delivery_make_available(uuid) to authenticated;

create or replace function public.naxa_delivery_reoffer(p_mission uuid,p_note text)
returns boolean
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=auth.uid();
  v_m public.naxa_delivery_missions%rowtype;
  v_role text;
begin
  if v_uid is null or p_note is null or length(trim(p_note))<5 or length(trim(p_note))>300 then
    raise exception 'Motif de réaffectation invalide';
  end if;
  select * into v_m from public.naxa_delivery_missions where id=p_mission for update;
  if not found then raise exception 'Mission introuvable'; end if;
  if not public.naxa_scope_allows(v_uid,v_m.pharmacie_id,'PHARMACIE') then raise exception 'Mission hors périmètre'; end if;
  v_role:=public.naxa_business_function(v_uid);
  if not public.is_admin() and v_role not in ('promoteur','pharmacie','gestionnaire_stock','magasinier','responsable') then
    raise exception 'Réaffectation réservée à la pharmacie ou au Promoteur';
  end if;
  if v_m.statut not in ('accepted','failed') or v_m.picked_up_at is not null then
    raise exception 'La mission ne peut être réouverte après le retrait du colis';
  end if;

  update public.naxa_delivery_mission_offers
  set offer_status='recalled'
  where mission_id=p_mission and offer_status in ('offered','accepted');

  update public.naxa_delivery_missions
  set livreur_id=null,statut='available',accepted_at=null,failed_at=null,
      failure_code=null,failure_note=null,updated_at=now()
  where id=p_mission;
  update public.reservations set commande_statut='preparation' where id=v_m.reservation_id;

  insert into public.naxa_delivery_mission_offers(mission_id,reservation_id,pharmacie_id,livreur_id)
  select v_m.id,v_m.reservation_id,v_m.pharmacie_id,a.profile_id
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id and p.actif=true
  where a.pharmacie_id=v_m.pharmacie_id and a.role_code='livreur' and a.statut='active'
    and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now());

  insert into public.naxa_delivery_events(mission_id,reservation_id,pharmacie_id,actor_id,event_type,label,detail)
  values(v_m.id,v_m.reservation_id,v_m.pharmacie_id,v_uid,'reoffered','Mission remise à disposition des livreurs',trim(p_note));

  insert into public.notifications(user_id,type,titre,corps,reservation_id,related_entity_id)
  select distinct a.profile_id,'delivery_mission','Livraison remise à disposition',
    'Une livraison attend un livreur.',v_m.reservation_id,v_m.id
  from public.naxa_professional_assignments a
  join public.profiles p on p.id=a.profile_id and p.actif=true
  where a.pharmacie_id=v_m.pharmacie_id and a.role_code='livreur' and a.statut='active'
    and a.commence_at<=now() and (a.expire_at is null or a.expire_at>now());
  return true;
end;
$function$;
revoke all on function public.naxa_delivery_reoffer(uuid,text) from public,anon;
grant execute on function public.naxa_delivery_reoffer(uuid,text) to authenticated;

create or replace function private.naxa_delivery_client_notification()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_title text;
  v_body text;
  v_client uuid;
begin
  if new.event_type in ('location','ready','reoffered') then return new; end if;
  select m.client_id into v_client from public.naxa_delivery_missions m where m.id=new.mission_id;
  v_title:=case new.event_type
    when 'accepted' then 'Livreur attribué'
    when 'picked_up' then 'Commande récupérée'
    when 'arrived' then 'Votre livreur est arrivé'
    when 'delivered' then 'Livraison confirmée'
    when 'failed' then 'Difficulté de livraison'
    when 'cancelled' then 'Livraison annulée'
    else 'Suivi de livraison mis à jour' end;
  v_body:=new.label;
  insert into public.notifications(user_id,type,titre,corps,reservation_id,related_entity_id)
  values(v_client,'delivery_update',v_title,v_body,new.reservation_id,new.mission_id);
  return new;
end;
$function$;

revoke all on function private.naxa_delivery_client_notification() from public,anon,authenticated;

commit;
