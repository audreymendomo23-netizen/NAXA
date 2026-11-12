-- Contrat SQL des alertes de disponibilité et de la distribution push.
begin;

do $$
begin
  if to_regclass('private.notification_push_outbox') is null then
    raise exception 'notification_push_outbox absent';
  end if;
  if to_regprocedure('public.claim_notification_push_outbox(integer)') is null
     or to_regprocedure('public.finish_notification_push_outbox(uuid,text,text)') is null then
    raise exception 'Fonctions de distribution push absentes';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname='trg_enqueue_notification_phone_push'
      and tgrelid='public.notifications'::regclass and not tgisinternal
  ) then
    raise exception 'Le trigger de distribution des notifications téléphone est absent';
  end if;

  if to_regclass('public.client_product_availability_alerts') is null
     or to_regclass('private.client_product_availability_deliveries') is null then
    raise exception 'Tables des alertes de disponibilité absentes';
  end if;
  if to_regprocedure('private.notify_client_product_availability()') is null then
    raise exception 'Fonction d''alerte de disponibilité absente';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname='trg_notify_client_product_availability'
      and tgrelid='public.stock_manager_movement_journal'::regclass and not tgisinternal
  ) then
    raise exception 'Le trigger des mouvements de stock est absent';
  end if;
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='client_product_availability_alerts'
      and c.relrowsecurity
  ) then
    raise exception 'RLS non activé sur les alertes client';
  end if;
end;
$$;

rollback;
