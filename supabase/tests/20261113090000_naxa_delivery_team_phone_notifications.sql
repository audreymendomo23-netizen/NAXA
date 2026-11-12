-- Vérifications de contrat : notifications métier téléphone et équipe livraison.
begin;

do $$
begin
  if to_regclass('private.notification_push_outbox') is null then
    raise exception 'File push globale absente';
  end if;
  if to_regprocedure('public.claim_notification_push_outbox(integer)') is null
     or to_regprocedure('public.finish_notification_push_outbox(uuid,text,text)') is null then
    raise exception 'Fonctions de cycle de vie push absentes';
  end if;
  if not exists(select 1 from pg_trigger where tgname='trg_enqueue_notification_phone_push'
    and tgrelid='public.notifications'::regclass and not tgisinternal) then
    raise exception 'Les notifications métier ne sont pas raccordées au téléphone';
  end if;
  if to_regclass('public.client_product_availability_alerts') is null
     or to_regclass('private.client_product_availability_state') is null
     or to_regclass('private.client_product_availability_deliveries') is null then
    raise exception 'Les tables d''alerte de disponibilité sont incomplètes';
  end if;
  if not exists(select 1 from pg_trigger where tgname='trg_notify_client_product_availability'
    and tgrelid='public.stock_manager_movement_journal'::regclass and not tgisinternal) then
    raise exception 'Le journal de stock ne déclenche pas les alertes';
  end if;
  if not exists(select 1 from pg_trigger where tgname='trg_naxa_delivery_notify_pharmacy_team'
    and tgrelid='public.naxa_delivery_events'::regclass and not tgisinternal) then
    raise exception 'Les événements de livraison ne notifient pas l''équipe pharmacie';
  end if;
  if not exists(select 1 from pg_class where oid='public.client_product_availability_alerts'::regclass and relrowsecurity) then
    raise exception 'RLS absent sur les abonnements de disponibilité';
  end if;
end;
$$;

rollback;
