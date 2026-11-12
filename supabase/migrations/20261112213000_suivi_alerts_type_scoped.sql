-- NAXA — les alertes professionnelles suivent chaque autorisation de mesure individuellement.
begin;

create or replace function public.queue_suivi_alert_push()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if not public.suivi_has_consent(
    new.user_id,public.suivi_measurement_family(new.measurement_type)
  ) then
    return new;
  end if;

  -- Le patient reçoit toujours ses propres alertes si son consentement est actif.
  insert into public.suivi_push_outbox(alert_id,patient_user_id,recipient_user_id,measurement_type)
  values(new.id,new.user_id,new.user_id,new.measurement_type)
  on conflict(alert_id,recipient_user_id) do nothing;

  -- Le droit professionnel est évalué par type de mesure, jamais par le droit
  -- agrégé du dossier clinique, qui peut couvrir une autre famille.
  insert into public.suivi_push_outbox(alert_id,patient_user_id,recipient_user_id,measurement_type)
  select new.id,new.user_id,s.recipient_user_id,new.measurement_type
  from public.suivi_shares s
  where s.owner_user_id=new.user_id
    and s.recipient_user_id<>new.user_id
    and s.measurement_type=new.measurement_type
    and s.active=true and s.revoked_at is null
    and s.allow_alerts=true
    and public.suivi_is_verified_professional(s.recipient_user_id)
  on conflict(alert_id,recipient_user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.queue_suivi_alert_push() from public,anon,authenticated;

commit;
