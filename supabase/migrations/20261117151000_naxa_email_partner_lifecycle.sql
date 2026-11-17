-- NAXA — événements e-mail des dossiers et abonnements partenaires indépendants.
begin;

-- Dossiers Parapharmacie / Examens / Prestations / Aide : la décision est envoyée au titulaire.
create or replace function private.naxa_partner_dossier_email_events()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_email text; v_universe text; v_label text; v_event text;
begin
  if new.dossier_status is not distinct from old.dossier_status then return new; end if;
  if new.dossier_status not in ('validated','rejected','refused') then return new; end if;
  select lower(u.email) into v_email
  from auth.users u where u.id=new.promoteur_id;
  v_universe:=case new.universe_slug
    when 'parapharmacie' then 'parapharmacie'
    when 'examens' then 'examens'
    when 'prestations' then 'prestations_domicile'
    when 'aide' then 'aide'
    else 'promoteur' end;
  v_label:=case new.universe_slug
    when 'parapharmacie' then 'Parapharmacie'
    when 'examens' then 'Examens médicaux'
    when 'prestations' then 'Prestations et soins à domicile'
    when 'aide' then 'Aide'
    else 'Partenaire' end;
  v_event:=case when new.dossier_status='validated' then 'partner.dossier.validated' else 'partner.dossier.rejected' end;
  perform private.naxa_queue_email(
    'partner-dossier:'||new.partner_id::text||':'||new.dossier_status,
    v_event,v_universe,v_email,
    case when new.dossier_status='validated' then 'NAXA — dossier '||v_label||' validé'
      else 'NAXA — décision sur votre dossier '||v_label end,
    case when new.dossier_status='validated'
      then 'Votre dossier '||v_label||' a été validé. Vous pouvez consulter votre espace professionnel NAXA et vérifier les conditions d''accès et d''abonnement applicables à cette structure.'
      else 'Votre dossier '||v_label||' n''a pas été validé. Connectez-vous à votre espace NAXA pour consulter la décision et les informations communiquées par l''administration.' end,
    new.promoteur_id,jsonb_build_object('partner_id',new.partner_id,'universe_slug',new.universe_slug,'status',new.dossier_status)
  );
  return new;
end;
$$;
drop trigger if exists trg_naxa_partner_dossier_email_events on public.admin_partner_dossiers;
create trigger trg_naxa_partner_dossier_email_events
after update of dossier_status on public.admin_partner_dossiers
for each row execute function private.naxa_partner_dossier_email_events();

-- Abonnements partenaires : les notifications métier existantes restent la source de vérité.
create or replace function private.naxa_partner_subscription_notification_email()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_email text; v_universe text;
begin
  if new.type not in (
    'partner_subscription_payment_submitted',
    'partner_subscription_payment_admin_review',
    'partner_subscription_payment_confirmed',
    'partner_subscription_payment_refused',
    'partner_subscription_due_5d'
  ) or new.user_id is null then return new; end if;

  select lower(u.email) into v_email from auth.users u where u.id=new.user_id;
  if v_email is null then return new; end if;

  if new.related_entity_id is not null then
    select case s.universe_slug
      when 'parapharmacie' then 'parapharmacie'
      when 'examens' then 'examens'
      when 'prestations' then 'prestations_domicile'
      else 'promoteur' end
    into v_universe
    from public.partner_subscription_payments p
    join public.partner_subscriptions s on s.partner_id=p.partner_id
    where p.id=new.related_entity_id;
  end if;
  v_universe:=coalesce(v_universe,'promoteur');

  perform private.naxa_queue_email(
    'partner-subscription-notification:'||new.id::text,
    'partner.subscription.'||replace(new.type,'partner_subscription_',''),
    v_universe,v_email,'NAXA — '||coalesce(new.titre,'Notification abonnement'),
    coalesce(new.corps,'Une mise à jour concerne votre abonnement partenaire. Connectez-vous à NAXA pour consulter votre espace.'),
    new.user_id,jsonb_build_object('notification_id',new.id,'related_entity_id',new.related_entity_id,'notification_type',new.type)
  );
  return new;
end;
$$;
drop trigger if exists trg_naxa_partner_subscription_notification_email on public.notifications;
create trigger trg_naxa_partner_subscription_notification_email
after insert on public.notifications
for each row execute function private.naxa_partner_subscription_notification_email();

-- Convention indépendante Prestations à domicile : validation et rappels J-5 propres à expires_at.
create or replace function private.naxa_home_agreement_email_events()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_email text;
begin
  if new.status is distinct from old.status and new.status='active' then
    select lower(email) into v_email from auth.users where id=new.professional_user_id;
    perform private.naxa_queue_email(
      'home-agreement-active:'||new.id::text,'partner.agreement.activated','prestations_domicile',v_email,
      'NAXA — convention Prestations à domicile activée',
      'Votre convention Prestations et soins à domicile a été approuvée. Consultez votre espace professionnel NAXA pour vérifier sa durée et les conditions applicables.',
      new.professional_user_id,jsonb_build_object('agreement_id',new.id,'partner_id',new.partner_id,'expires_at',new.expires_at)
    );
  end if;
  return new;
end;
$$;
drop trigger if exists trg_naxa_home_agreement_email_events on public.partner_independent_agreements;
create trigger trg_naxa_home_agreement_email_events
after update of status on public.partner_independent_agreements
for each row execute function private.naxa_home_agreement_email_events();

create or replace function public.emettre_rappels_conventions_prestations_email()
returns integer language plpgsql security definer set search_path=''
as $$
declare v_count integer;
begin
  insert into private.email_delivery_outbox(event_key,event_type,universe,recipient_email,subject,text_body,recipient_user_id,metadata)
  select 'home-agreement-expiry-5d:'||a.id::text,'partner.agreement.expiring','prestations_domicile',
    lower(u.email),'NAXA — votre convention arrive à échéance',
    'Votre convention Prestations et soins à domicile arrive à échéance dans cinq jours. Connectez-vous à NAXA pour consulter sa date de fin et les démarches applicables.',
    a.professional_user_id,jsonb_build_object('agreement_id',a.id,'partner_id',a.partner_id,'expires_at',a.expires_at)
  from public.partner_independent_agreements a
  join auth.users u on u.id=a.professional_user_id
  where a.status='active' and a.expires_at is not null
    and a.expires_at>now() and a.expires_at<=now()+interval '5 days'
  on conflict(event_key) do nothing;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;
revoke all on function public.emettre_rappels_conventions_prestations_email() from public,anon,authenticated;
grant execute on function public.emettre_rappels_conventions_prestations_email() to service_role;

commit;
