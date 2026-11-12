-- NAXA — retrait de consentement atomique : aucun partage ancien ne se réactive seul.
begin;

create or replace function public.suivi_set_family_consent(
  p_family text,
  p_granted boolean
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_patient uuid:=auth.uid();
  v_now timestamptz:=now();
begin
  if v_patient is null or not public.suivi_is_enabled_user(v_patient) then
    raise exception 'Session patient invalide';
  end if;
  if p_family is null or p_family not in ('constantes','metabolisme','activite','sommeil','bien_etre','traitements')
     or p_granted is null then
    raise exception 'Famille de consentement invalide';
  end if;

  insert into public.suivi_consents(
    user_id,family_key,granted,consent_version,granted_at,revoked_at,updated_at
  ) values(
    v_patient,p_family,p_granted,'1.0',
    case when p_granted then v_now else null end,
    case when p_granted then null else v_now end,v_now
  )
  on conflict(user_id,family_key) do update set
    granted=excluded.granted,
    consent_version=excluded.consent_version,
    granted_at=case when excluded.granted then v_now else public.suivi_consents.granted_at end,
    revoked_at=excluded.revoked_at,
    updated_at=v_now;

  if not p_granted then
    update public.suivi_shares
    set active=false,revoked_at=coalesce(revoked_at,v_now)
    where owner_user_id=v_patient
      and public.suivi_measurement_family(measurement_type)=p_family
      and (active=true or revoked_at is null);

    update public.suivi_care_links l
    set history_access=coalesce(share_rights.history_access,false),
        realtime_access=coalesce(share_rights.realtime_access,false),
        alerts_access=coalesce(share_rights.alerts_access,false),
        active=coalesce(share_rights.history_access,false)
          or coalesce(share_rights.realtime_access,false)
          or coalesce(share_rights.alerts_access,false)
          or l.clinical_notes_access,
        revoked_at=case when (
          coalesce(share_rights.history_access,false)
          or coalesce(share_rights.realtime_access,false)
          or coalesce(share_rights.alerts_access,false)
          or l.clinical_notes_access
        ) then null else v_now end
    from (
      select s.recipient_user_id,
        bool_or(s.active and s.revoked_at is null and s.allow_history) as history_access,
        bool_or(s.active and s.revoked_at is null and s.allow_realtime) as realtime_access,
        bool_or(s.active and s.revoked_at is null and s.allow_alerts) as alerts_access
      from public.suivi_shares s
      where s.owner_user_id=v_patient
      group by s.recipient_user_id
    ) share_rights
    where l.patient_user_id=v_patient
      and l.professional_user_id=share_rights.recipient_user_id;

    update public.suivi_care_links l
    set history_access=false,realtime_access=false,alerts_access=false,
        active=l.clinical_notes_access,
        revoked_at=case when l.clinical_notes_access then null else v_now end
    where l.patient_user_id=v_patient
      and not exists(
        select 1 from public.suivi_shares s
        where s.owner_user_id=v_patient and s.recipient_user_id=l.professional_user_id
          and s.active=true and s.revoked_at is null
      );
  end if;
end;
$$;

revoke all on function public.suivi_set_family_consent(text,boolean) from public,anon;
grant execute on function public.suivi_set_family_consent(text,boolean) to authenticated;

commit;
