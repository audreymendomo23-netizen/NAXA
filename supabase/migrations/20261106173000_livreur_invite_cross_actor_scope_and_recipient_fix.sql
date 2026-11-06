-- NAXA — corrige l'autorisation de l'émetteur hors session du bénéficiaire.
-- Une fonction publique de contexte ne doit pas être utilisée pour inspecter un autre profil.
-- La notification d'activation cible exclusivement l'utilisateur destinataire.

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
      and p.date_of_birth <= (current_date - interval '18 years')::date
  ) then
    raise exception 'Finalisez d’abord votre compte Client, les vérifications obligatoires et la majorité NAXA';
  end if;

  if not exists(select 1 from public.pharmacies p where p.id=v_invite.pharmacie_id and p.actif=true and p.archivee_le is null) then
    raise exception 'La pharmacie a été suspendue ou archivée';
  end if;

  -- L'invitant est un autre profil : utiliser les helpers privés serveur,
  -- jamais les façades publiques qui ne révèlent que le contexte auth.uid().
  v_role:=private.naxa_business_function(v_invite.inviteur_id);
  if v_role='promoteur' then
    if not private.naxa_promoteur_valide(v_invite.inviteur_id)
      or not exists(select 1 from public.promoteur_pharmacies pp
        where pp.promoteur_id=v_invite.inviteur_id and pp.pharmacie_id=v_invite.pharmacie_id and pp.actif) then
      raise exception 'L’autorisation du Promoteur a changé : demandez une nouvelle invitation';
    end if;
  elsif v_role='pharmacie' then
    if private.naxa_active_role_pharmacy(v_invite.inviteur_id) is distinct from v_invite.pharmacie_id
      or not private.naxa_scope_allows(v_invite.inviteur_id,v_invite.pharmacie_id,'PHARMACIE') then
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

  -- La contrainte notifications_un_destinataire impose une cible unique.
  insert into public.notifications(user_id,type,titre,corps,related_entity_id)
  values(v_uid,'professional_assignment','Poste Livreur activé',
    'Votre compte Livreur est actif. Vous pouvez ouvrir votre tableau de bord NAXA.',v_assignment);

  return jsonb_build_object('accepted',true,'role','livreur','pharmacie_id',v_invite.pharmacie_id,'assignment_id',v_assignment);
end;
$function$;

revoke all on function public.naxa_accept_livreur_invite(uuid) from public,anon;
grant execute on function public.naxa_accept_livreur_invite(uuid) to authenticated;

commit;
