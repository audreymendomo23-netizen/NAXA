-- NAXA — raccordement métier des e-mails : activation, invitations, décisions et rappels.
-- Additif : conserve les jetons et mécanismes d'acceptation propres à chaque univers.
begin;

create or replace function private.naxa_queue_email(
  p_event_key text, p_event_type text, p_universe text, p_email text,
  p_subject text, p_body text, p_user_id uuid default null, p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_id uuid; v_email text:=lower(trim(coalesce(p_email,'')));
begin
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or length(v_email)>254 or p_event_key is null
     or p_event_key !~ '^[a-zA-Z0-9_.:-]{8,180}$'
     or p_subject is null or length(trim(p_subject)) not between 1 and 180
     or p_body is null or length(trim(p_body)) not between 1 and 10000 then
    return null;
  end if;
  insert into private.email_delivery_outbox(
    event_key,event_type,universe,recipient_email,recipient_user_id,subject,text_body,metadata
  ) values (
    p_event_key,p_event_type,p_universe,v_email,p_user_id,trim(p_subject),p_body,coalesce(p_metadata,'{}'::jsonb)
  ) on conflict(event_key) do update set event_key=excluded.event_key
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function private.naxa_queue_email(text,text,text,text,text,text,uuid,jsonb) from public,anon,authenticated;

-- Invitations Examens : URL exacte de la page et token déjà utilisés par le parcours.
create or replace function private.naxa_exam_invite_email_events()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_inviter_email text; v_recipient_email text; v_link text;
begin
  if tg_op='INSERT' then
    v_link := 'https://nnaxa.vercel.app/invitation/personnel-examen?token='||new.token::text;
    perform private.naxa_queue_email(
      'exam-invite-created:'||new.id::text,'partner.invitation.created','examens',new.email,
      'NAXA — invitation au personnel du centre',
      'Vous êtes invité(e) à rejoindre un centre d''examens sur NAXA.'||E'\n\n'
      ||'Poste : '||new.role_key||E'\n'
      ||'Accepter ou consulter l''invitation : '||v_link||E'\n'
      ||'Cette invitation expire le : '||to_char(new.expires_at at time zone 'Africa/Douala','DD/MM/YYYY HH24:MI')||' (heure du Cameroun).',
      null,jsonb_build_object('invite_id',new.id,'center_id',new.center_id,'role_key',new.role_key,'expires_at',new.expires_at)
    );
    return new;
  end if;
  if old.accepted_at is null and new.accepted_at is not null then
    select lower(email) into v_inviter_email from auth.users where id=new.inviter_id;
    perform private.naxa_queue_email(
      'exam-invite-accepted:'||new.id::text,'partner.invitation.accepted','examens',v_inviter_email,
      'NAXA — invitation au personnel acceptée',
      'Votre invitation au personnel du centre d''examens a été acceptée. Vous pouvez consulter les affectations dans votre espace NAXA.',
      new.inviter_id,jsonb_build_object('invite_id',new.id,'center_id',new.center_id,'accepted_by',new.accepted_by)
    );
  elsif old.revoked_at is null and new.revoked_at is not null then
    perform private.naxa_queue_email(
      'exam-invite-revoked:'||new.id::text,'partner.invitation.revoked','examens',new.email,
      'NAXA — invitation révoquée',
      'L''invitation à rejoindre le centre d''examens a été révoquée. Contactez la structure émettrice pour toute information.',
      null,jsonb_build_object('invite_id',new.id,'center_id',new.center_id)
    );
  end if;
  return new;
end;
$$;
drop trigger if exists trg_naxa_exam_invite_email_events on public.exam_staff_invites;
create trigger trg_naxa_exam_invite_email_events
after insert or update of accepted_at,revoked_at on public.exam_staff_invites
for each row execute function private.naxa_exam_invite_email_events();

-- Invitations Livreur : conserve le token et la route d'acceptation existants.
create or replace function private.naxa_livreur_invite_email_events()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_inviter_email text; v_link text;
begin
  if tg_op='INSERT' then
    v_link := 'https://nnaxa.vercel.app/invitation/livreur?token='||new.token::text;
    perform private.naxa_queue_email(
      'livreur-invite-created:'||new.token::text,'partner.invitation.created','livreur',new.email,
      'NAXA — invitation au poste Livreur',
      'Vous êtes invité(e) à rejoindre une pharmacie en qualité de Livreur.'||E'\n\n'
      ||'Accepter ou consulter l''invitation : '||v_link||E'\n'
      ||'Cette invitation expire le : '||to_char(new.expires_at at time zone 'Africa/Douala','DD/MM/YYYY HH24:MI')||' (heure du Cameroun).',
      null,jsonb_build_object('invite_token',new.token,'pharmacie_id',new.pharmacie_id,'expires_at',new.expires_at)
    );
    return new;
  end if;
  if old.accepted_at is null and new.accepted_at is not null then
    select lower(email) into v_inviter_email from auth.users where id=new.inviteur_id;
    perform private.naxa_queue_email(
      'livreur-invite-accepted:'||new.token::text,'partner.invitation.accepted','livreur',v_inviter_email,
      'NAXA — invitation Livreur acceptée',
      'Votre invitation au poste Livreur a été acceptée. Le collaborateur peut désormais accéder à son espace selon les droits actifs.',
      new.inviteur_id,jsonb_build_object('invite_token',new.token,'pharmacie_id',new.pharmacie_id,'accepted_by',new.accepted_by)
    );
  elsif old.revoked_at is null and new.revoked_at is not null then
    perform private.naxa_queue_email(
      'livreur-invite-revoked:'||new.token::text,'partner.invitation.revoked','livreur',new.email,
      'NAXA — invitation Livreur révoquée',
      'L''invitation au poste Livreur a été révoquée. Contactez la pharmacie émettrice pour toute information.',
      null,jsonb_build_object('invite_token',new.token,'pharmacie_id',new.pharmacie_id)
    );
  end if;
  return new;
end;
$$;
drop trigger if exists trg_naxa_livreur_invite_email_events on public.naxa_livreur_invites;
create trigger trg_naxa_livreur_invite_email_events
after insert or update of accepted_at,revoked_at on public.naxa_livreur_invites
for each row execute function private.naxa_livreur_invite_email_events();

-- Activation : aucun OTP n'est envoyé ici. L'événement part uniquement après confirmation Auth.
create or replace function private.naxa_auth_activation_email()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_name text;
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null and new.email is not null then
    select nullif(trim(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')),'')
      into v_name from public.profiles p where p.id=new.id;
    perform private.naxa_queue_email(
      'account-activated:'||new.id::text,'account.activated','client',new.email,
      'NAXA — compte activé',
      'Bonjour'||case when v_name is not null then ' '||v_name else '' end||E',\n\n'
      ||'Votre adresse e-mail est confirmée et votre compte NAXA peut poursuivre son parcours de configuration.'
      ||E'\n\n'||'Connectez-vous depuis https://nnaxa.vercel.app/ .',
      new.id,jsonb_build_object('user_id',new.id)
    );
  end if;
  return new;
end;
$$;
drop trigger if exists trg_naxa_auth_activation_email on auth.users;
create trigger trg_naxa_auth_activation_email
after update of email_confirmed_at on auth.users
for each row execute function private.naxa_auth_activation_email();

-- Rappels J-1 des invitations encore valides : appelés par le worker périodique.
create or replace function public.emettre_rappels_invitations_email()
returns integer language plpgsql security definer set search_path=''
as $$
declare v_count integer:=0; v_rows integer;
begin
  insert into private.email_delivery_outbox(event_key,event_type,universe,recipient_email,subject,text_body,metadata)
  select 'exam-invite-expiry-24h:'||i.id::text,'partner.invitation.expiring','examens',i.email,
    'NAXA — votre invitation expire bientôt',
    'Votre invitation au personnel du centre d''examens expire dans environ 24 heures. Ouvrez le lien reçu dans le message initial pour l''accepter.',
    jsonb_build_object('invite_id',i.id,'expires_at',i.expires_at)
  from public.exam_staff_invites i
  where i.accepted_at is null and i.revoked_at is null
    and i.expires_at>now() and i.expires_at<=now()+interval '24 hours'
  on conflict(event_key) do nothing;
  get diagnostics v_rows=row_count; v_count:=v_count+v_rows;

  insert into private.email_delivery_outbox(event_key,event_type,universe,recipient_email,subject,text_body,metadata)
  select 'livreur-invite-expiry-24h:'||i.token::text,'partner.invitation.expiring','livreur',i.email,
    'NAXA — votre invitation expire bientôt',
    'Votre invitation au poste Livreur expire dans environ 24 heures. Ouvrez le lien reçu dans le message initial pour l''accepter.',
    jsonb_build_object('invite_token',i.token,'expires_at',i.expires_at)
  from public.naxa_livreur_invites i
  where i.accepted_at is null and i.revoked_at is null
    and i.expires_at>now() and i.expires_at<=now()+interval '24 hours'
  on conflict(event_key) do nothing;
  get diagnostics v_rows=row_count; v_count:=v_count+v_rows;
  return v_count;
end;
$$;
revoke all on function public.emettre_rappels_invitations_email() from public,anon,authenticated;
grant execute on function public.emettre_rappels_invitations_email() to service_role;

commit;
