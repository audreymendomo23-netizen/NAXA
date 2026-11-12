-- NAXA — cycle de partage atomique et chronologie clinique alimentée par les mesures.
begin;

-- Un même parcours patient pilote désormais les partages par type et le dossier clinique.
create or replace function public.suivi_upsert_professional_share(
  p_recipient_user_id uuid,
  p_measurement_type text,
  p_allow_history boolean,
  p_allow_realtime boolean,
  p_allow_alerts boolean,
  p_clinical_notes_access boolean
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_patient uuid := auth.uid();
  v_family text;
  v_now timestamptz := now();
  v_history boolean := false;
  v_realtime boolean := false;
  v_alerts boolean := false;
begin
  if v_patient is null or p_recipient_user_id is null or p_recipient_user_id = v_patient then
    raise exception 'Identité patient ou professionnel invalide';
  end if;
  if not public.suivi_is_enabled_user(v_patient) then
    raise exception 'Suivi connecté indisponible pour ce compte';
  end if;
  v_family := public.suivi_measurement_family(p_measurement_type);
  if v_family is null then
    raise exception 'Type de mesure non pris en charge';
  end if;
  if not public.suivi_has_consent(v_patient, v_family) then
    raise exception 'Consentement patient requis';
  end if;
  if not public.suivi_is_verified_professional(p_recipient_user_id) then
    raise exception 'Professionnel non agréé, expiré ou désactivé';
  end if;
  if not coalesce(p_allow_history,false)
     and not coalesce(p_allow_realtime,false)
     and not coalesce(p_allow_alerts,false)
     and not coalesce(p_clinical_notes_access,false) then
    raise exception 'Au moins une autorisation doit être activée';
  end if;

  insert into public.suivi_shares as current_share(
    owner_user_id,recipient_user_id,measurement_type,active,granted_at,revoked_at,
    allow_history,allow_realtime,allow_alerts,realtime_from_at
  ) values (
    v_patient,p_recipient_user_id,p_measurement_type,true,v_now,null,
    coalesce(p_allow_history,false),coalesce(p_allow_realtime,false),
    coalesce(p_allow_alerts,false),
    case when coalesce(p_allow_realtime,false) then v_now else null end
  )
  on conflict(owner_user_id,recipient_user_id,measurement_type) do update set
    active=true,
    granted_at=case
      when current_share.active and current_share.revoked_at is null
        and current_share.allow_history=coalesce(p_allow_history,false)
      then current_share.granted_at
      else v_now
    end,
    revoked_at=null,
    allow_history=coalesce(p_allow_history,false),
    allow_realtime=coalesce(p_allow_realtime,false),
    allow_alerts=coalesce(p_allow_alerts,false),
    realtime_from_at=case
      when coalesce(p_allow_realtime,false) then
        case when current_share.active and current_share.revoked_at is null and current_share.allow_realtime
          then coalesce(current_share.realtime_from_at,v_now) else v_now end
      else null end;

  select coalesce(bool_or(s.allow_history),false),
         coalesce(bool_or(s.allow_realtime),false),
         coalesce(bool_or(s.allow_alerts),false)
    into v_history,v_realtime,v_alerts
  from public.suivi_shares s
  where s.owner_user_id=v_patient and s.recipient_user_id=p_recipient_user_id
    and s.active=true and s.revoked_at is null;

  insert into public.suivi_care_links as current_link(
    patient_user_id,professional_user_id,active,history_access,realtime_access,
    alerts_access,clinical_notes_access,accepted_at,revoked_at
  ) values (
    v_patient,p_recipient_user_id,
    v_history or v_realtime or v_alerts or coalesce(p_clinical_notes_access,false),
    v_history,v_realtime,v_alerts,coalesce(p_clinical_notes_access,false),v_now,null
  )
  on conflict(patient_user_id,professional_user_id) do update set
    active=excluded.active,
    history_access=excluded.history_access,
    realtime_access=excluded.realtime_access,
    alerts_access=excluded.alerts_access,
    clinical_notes_access=excluded.clinical_notes_access,
    accepted_at=case when current_link.active and current_link.revoked_at is null
      then current_link.accepted_at else v_now end,
    revoked_at=null;
end;
$$;

create or replace function public.suivi_revoke_professional_share_type(
  p_recipient_user_id uuid,
  p_measurement_type text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_patient uuid := auth.uid();
  v_now timestamptz := now();
  v_history boolean := false;
  v_realtime boolean := false;
  v_alerts boolean := false;
  v_clinical boolean := false;
begin
  if v_patient is null or not public.suivi_is_enabled_user(v_patient) then
    raise exception 'Session patient invalide';
  end if;
  update public.suivi_shares
    set active=false,revoked_at=coalesce(revoked_at,v_now)
  where owner_user_id=v_patient and recipient_user_id=p_recipient_user_id
    and measurement_type=p_measurement_type and active=true;

  select coalesce(bool_or(s.allow_history),false),
         coalesce(bool_or(s.allow_realtime),false),
         coalesce(bool_or(s.allow_alerts),false)
    into v_history,v_realtime,v_alerts
  from public.suivi_shares s
  where s.owner_user_id=v_patient and s.recipient_user_id=p_recipient_user_id
    and s.active=true and s.revoked_at is null;

  select coalesce((
    select l.clinical_notes_access
    from public.suivi_care_links l
    where l.patient_user_id=v_patient and l.professional_user_id=p_recipient_user_id
  ),false) into v_clinical;

  update public.suivi_care_links
  set history_access=v_history,realtime_access=v_realtime,alerts_access=v_alerts,
      active=(v_history or v_realtime or v_alerts or v_clinical),
      revoked_at=case when (v_history or v_realtime or v_alerts or v_clinical) then null else v_now end
  where patient_user_id=v_patient and professional_user_id=p_recipient_user_id;
end;
$$;

create or replace function public.suivi_disconnect_professional(p_recipient_user_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_patient uuid := auth.uid();
  v_now timestamptz := now();
begin
  if v_patient is null or p_recipient_user_id is null or not public.suivi_is_enabled_user(v_patient) then
    raise exception 'Session patient invalide';
  end if;
  update public.suivi_shares
    set active=false,revoked_at=coalesce(revoked_at,v_now)
  where owner_user_id=v_patient and recipient_user_id=p_recipient_user_id
    and (active=true or revoked_at is null);
  update public.suivi_care_links
    set active=false,history_access=false,realtime_access=false,alerts_access=false,
        clinical_notes_access=false,revoked_at=v_now
  where patient_user_id=v_patient and professional_user_id=p_recipient_user_id;
end;
$$;

-- Le patient conserve un accès en lecture à son propre dossier clinique.
drop policy if exists suivi_patient_cases_owner_select on public.suivi_patient_cases;
create policy suivi_patient_cases_owner_select on public.suivi_patient_cases
for select to authenticated
using(
  patient_user_id=(select auth.uid())
  and public.suivi_is_enabled_user((select auth.uid()))
);
drop policy if exists suivi_clinical_entries_owner_select on public.suivi_clinical_entries;
create policy suivi_clinical_entries_owner_select on public.suivi_clinical_entries
for select to authenticated
using(
  exists(
    select 1 from public.suivi_patient_cases c
    where c.id=suivi_clinical_entries.case_id
      and c.patient_user_id=(select auth.uid())
      and public.suivi_is_enabled_user((select auth.uid()))
  )
);

-- Le patient peut retirer indépendamment le droit de consulter le dossier clinique.
create or replace function public.suivi_revoke_clinical_notes_access(p_professional_user_id uuid)
returns void
language plpgsql
security definer
set search_path=''
as $
declare
  v_patient uuid:=auth.uid();
  v_now timestamptz:=now();
  v_history boolean:=false;
  v_realtime boolean:=false;
  v_alerts boolean:=false;
begin
  if v_patient is null or p_professional_user_id is null
     or not public.suivi_is_enabled_user(v_patient) then
    raise exception 'Session patient invalide';
  end if;

  update public.suivi_care_links
  set clinical_notes_access=false
  where patient_user_id=v_patient and professional_user_id=p_professional_user_id;

  -- Les lignes qui ne portaient que le droit clinique ne doivent pas maintenir
  -- une pseudo-autorisation de mesure dans la liste des patients partagés.
  update public.suivi_shares
  set active=false,revoked_at=coalesce(revoked_at,v_now)
  where owner_user_id=v_patient and recipient_user_id=p_professional_user_id
    and active=true and not allow_history and not allow_realtime and not allow_alerts;

  select coalesce(bool_or(s.allow_history),false),
         coalesce(bool_or(s.allow_realtime),false),
         coalesce(bool_or(s.allow_alerts),false)
    into v_history,v_realtime,v_alerts
  from public.suivi_shares s
  where s.owner_user_id=v_patient and s.recipient_user_id=p_professional_user_id
    and s.active=true and s.revoked_at is null;

  update public.suivi_care_links
  set history_access=v_history,realtime_access=v_realtime,alerts_access=v_alerts,
      active=(v_history or v_realtime or v_alerts),
      revoked_at=case when (v_history or v_realtime or v_alerts) then null else v_now end
  where patient_user_id=v_patient and professional_user_id=p_professional_user_id;
end;
$;

-- Création du dossier et première entrée diagnostique dans une seule transaction.
create or replace function public.suivi_create_patient_case(
  p_patient_user_id uuid,
  p_initial_diagnosis text,
  p_monitoring_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_professional uuid := auth.uid();
  v_case_id uuid;
begin
  if v_professional is null
     or not public.suivi_is_enabled_user(v_professional)
     or not public.suivi_is_verified_professional(v_professional) then
    raise exception 'Professionnel non autorisé';
  end if;
  if length(trim(coalesce(p_initial_diagnosis,''))) not between 3 and 4000 then
    raise exception 'Diagnostic initial invalide';
  end if;
  if not exists(
    select 1 from public.suivi_care_links l
    where l.patient_user_id=p_patient_user_id
      and l.professional_user_id=v_professional
      and l.active=true and l.revoked_at is null
      and l.clinical_notes_access=true
  ) then
    raise exception 'Le patient n’a pas autorisé le dossier clinique';
  end if;
  if exists(select 1 from public.suivi_patient_cases c
      where c.patient_user_id=p_patient_user_id and c.professional_user_id=v_professional) then
    raise exception 'Le dossier clinique existe déjà';
  end if;
  insert into public.suivi_patient_cases(
    patient_user_id,professional_user_id,initial_diagnosis,monitoring_reason,status
  ) values (
    p_patient_user_id,v_professional,trim(p_initial_diagnosis),nullif(trim(p_monitoring_reason),''),'active'
  ) returning id into v_case_id;
  insert into public.suivi_clinical_entries(case_id,professional_user_id,entry_type,content)
  values(v_case_id,v_professional,'diagnosis',trim(p_initial_diagnosis));
  return v_case_id;
end;
$$;

create or replace function public.suivi_add_clinical_entry(
  p_case_id uuid,
  p_entry_type text,
  p_content text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_professional uuid := auth.uid();
  v_patient uuid;
begin
  if v_professional is null
     or not public.suivi_is_enabled_user(v_professional)
     or not public.suivi_is_verified_professional(v_professional) then
    raise exception 'Professionnel non autorisé';
  end if;
  if p_entry_type not in ('diagnosis','observation','follow_up')
     or length(trim(coalesce(p_content,''))) not between 3 and 6000 then
    raise exception 'Entrée clinique invalide';
  end if;
  select c.patient_user_id into v_patient
  from public.suivi_patient_cases c
  join public.suivi_care_links l
    on l.patient_user_id=c.patient_user_id
   and l.professional_user_id=c.professional_user_id
  where c.id=p_case_id and c.professional_user_id=v_professional
    and l.active=true and l.revoked_at is null and l.clinical_notes_access=true;
  if not found then raise exception 'Accès au dossier clinique révoqué'; end if;

  insert into public.suivi_clinical_entries(case_id,professional_user_id,entry_type,content)
  values(p_case_id,v_professional,p_entry_type,trim(p_content));
  if p_entry_type='diagnosis' then
    update public.suivi_patient_cases
      set initial_diagnosis=trim(p_content),updated_at=now()
    where id=p_case_id and professional_user_id=v_professional;
  end if;
end;
$$;

-- Le flux en temps réel se fonde sur l'instant de réception serveur.
-- measured_at reste réservé au cadrage de l'historique déjà existant.
drop policy if exists suivi_measurements_owner_select on public.suivi_measurements;
create policy suivi_measurements_owner_select on public.suivi_measurements
for select to authenticated using(
  (user_id=(select auth.uid()) and public.suivi_is_enabled_user((select auth.uid())))
  or (
    public.suivi_is_enabled_user((select auth.uid()))
    and public.suivi_is_verified_professional((select auth.uid()))
    and public.suivi_has_consent(user_id,public.suivi_measurement_family(measurement_type))
    and exists(
      select 1 from public.suivi_shares s
      where s.owner_user_id=suivi_measurements.user_id
        and s.recipient_user_id=(select auth.uid())
        and s.measurement_type=suivi_measurements.measurement_type
        and s.active=true and s.revoked_at is null
        and (
          (s.allow_history and suivi_measurements.measured_at<=s.granted_at)
          or
          (s.allow_realtime and s.realtime_from_at is not null and suivi_measurements.received_at>=s.realtime_from_at)
        )
    )
  )
);

-- Les mesures sont ajoutées à la chronologie à leur réception, même si l'appareil
-- fournit un timestamp de mesure antérieur à l'activation du flux.
-- Les mesures réellement autorisées en temps réel deviennent des éléments de la chronologie clinique.
alter table public.suivi_clinical_entries
  add column if not exists measurement_id uuid references public.suivi_measurements(id) on delete set null;
alter table public.suivi_clinical_entries
  drop constraint if exists suivi_clinical_entries_entry_type_check;
alter table public.suivi_clinical_entries
  add constraint suivi_clinical_entries_entry_type_check
  check(entry_type in ('diagnosis','observation','follow_up','measurement'));
create unique index if not exists suivi_clinical_entries_measurement_professional_uidx
  on public.suivi_clinical_entries(measurement_id,professional_user_id)
  where measurement_id is not null;

create or replace function public.suivi_append_shared_measurement_to_clinical_timeline()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if not public.suivi_has_consent(
      new.user_id,public.suivi_measurement_family(new.measurement_type)
    ) then
    return new;
  end if;

  insert into public.suivi_clinical_entries(
    case_id,professional_user_id,entry_type,content,measurement_id
  )
  select
    c.id,l.professional_user_id,'measurement',
    'Mesure reçue — ' || new.measurement_type || ' : ' ||
      coalesce(new.value_numeric::text,new.value_text,'valeur non renseignée') ||
      coalesce(' ' || nullif(new.unit,''),'') ||
      ' · relevée le ' || to_char(new.measured_at at time zone 'UTC','YYYY-MM-DD HH24:MI:SS') || ' UTC' ||
      case when nullif(trim(new.note),'') is not null then ' · note : ' || trim(new.note) else '' end,
    new.id
  from public.suivi_patient_cases c
  join public.suivi_care_links l
    on l.patient_user_id=c.patient_user_id
   and l.professional_user_id=c.professional_user_id
  join public.suivi_shares s
    on s.owner_user_id=new.user_id
   and s.recipient_user_id=l.professional_user_id
   and s.measurement_type=new.measurement_type
  where c.patient_user_id=new.user_id
    and c.status='active'
    and l.active=true and l.revoked_at is null and l.clinical_notes_access=true
    and s.active=true and s.revoked_at is null
    and s.allow_realtime=true and s.realtime_from_at is not null
    and new.received_at>=s.realtime_from_at
    and public.suivi_is_verified_professional(l.professional_user_id)
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function public.suivi_append_shared_measurement_to_clinical_timeline() from public,anon,authenticated;
drop trigger if exists suivi_append_shared_measurement_to_clinical_timeline on public.suivi_measurements;
create trigger suivi_append_shared_measurement_to_clinical_timeline
after insert on public.suivi_measurements
for each row execute function public.suivi_append_shared_measurement_to_clinical_timeline();

revoke all on function public.suivi_upsert_professional_share(uuid,text,boolean,boolean,boolean,boolean) from public,anon;
revoke all on function public.suivi_revoke_professional_share_type(uuid,text) from public,anon;
revoke all on function public.suivi_disconnect_professional(uuid) from public,anon;
revoke all on function public.suivi_create_patient_case(uuid,text,text) from public,anon;
revoke all on function public.suivi_add_clinical_entry(uuid,text,text) from public,anon;
grant execute on function public.suivi_upsert_professional_share(uuid,text,boolean,boolean,boolean,boolean) to authenticated;
grant execute on function public.suivi_revoke_professional_share_type(uuid,text) to authenticated;
grant execute on function public.suivi_disconnect_professional(uuid) to authenticated;
revoke all on function public.suivi_revoke_clinical_notes_access(uuid) from public,anon;
grant execute on function public.suivi_revoke_clinical_notes_access(uuid) to authenticated;
grant execute on function public.suivi_create_patient_case(uuid,text,text) to authenticated;
grant execute on function public.suivi_add_clinical_entry(uuid,text,text) to authenticated;

commit;
