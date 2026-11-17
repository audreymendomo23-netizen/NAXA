-- NAXA — corrige le rattachement des rappels J-5 au partenaire (related_entity_id = partner_id).
begin;
create or replace function private.naxa_partner_subscription_notification_email()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_email text; v_universe text; v_partner_id uuid;
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

  select p.partner_id into v_partner_id
  from public.partner_subscription_payments p
  where p.id=new.related_entity_id;

  v_partner_id:=coalesce(v_partner_id,new.related_entity_id);

  select case s.universe_slug
    when 'parapharmacie' then 'parapharmacie'
    when 'examens' then 'examens'
    when 'prestations' then 'prestations_domicile'
    else 'promoteur' end
  into v_universe
  from public.partner_subscriptions s
  where s.partner_id=v_partner_id;

  v_universe:=coalesce(v_universe,'promoteur');

  perform private.naxa_queue_email(
    'partner-subscription-notification:'||new.id::text,
    'partner.subscription.'||replace(new.type,'partner_subscription_',''),
    v_universe,v_email,'NAXA — '||coalesce(new.titre,'Notification abonnement'),
    coalesce(new.corps,'Une mise à jour concerne votre abonnement partenaire. Connectez-vous à NAXA pour consulter votre espace.'),
    new.user_id,jsonb_build_object('notification_id',new.id,'related_entity_id',new.related_entity_id,'partner_id',v_partner_id,'notification_type',new.type)
  );
  return new;
end;
$$;
commit;
