-- NAXA — cycle de vie du dossier clinique : actif, pause, clôture.
begin;

create or replace function public.suivi_set_patient_case_status(
  p_case_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_professional uuid:=auth.uid();
  v_current text;
begin
  if v_professional is null
     or not public.suivi_is_enabled_user(v_professional)
     or not public.suivi_is_verified_professional(v_professional) then
    raise exception 'Professionnel non autorisé';
  end if;
  if p_status not in ('active','paused','closed') then
    raise exception 'Statut de dossier invalide';
  end if;

  select c.status into v_current
  from public.suivi_patient_cases c
  join public.suivi_care_links l
    on l.patient_user_id=c.patient_user_id
   and l.professional_user_id=c.professional_user_id
  where c.id=p_case_id
    and c.professional_user_id=v_professional
    and l.active=true and l.revoked_at is null
    and l.clinical_notes_access=true
  for update of c;
  if not found then raise exception 'Dossier introuvable ou accès clinique révoqué'; end if;
  if v_current='closed' then raise exception 'Un dossier clôturé ne peut pas être réactivé'; end if;

  update public.suivi_patient_cases
  set status=p_status,updated_at=now()
  where id=p_case_id and professional_user_id=v_professional;
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
  v_professional uuid:=auth.uid();
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
  if not exists(
    select 1
    from public.suivi_patient_cases c
    join public.suivi_care_links l
      on l.patient_user_id=c.patient_user_id
     and l.professional_user_id=c.professional_user_id
    where c.id=p_case_id
      and c.professional_user_id=v_professional
      and c.status='active'
      and l.active=true and l.revoked_at is null and l.clinical_notes_access=true
  ) then
    raise exception 'Le dossier est en pause, clôturé ou son accès clinique a été révoqué';
  end if;

  insert into public.suivi_clinical_entries(case_id,professional_user_id,entry_type,content)
  values(p_case_id,v_professional,p_entry_type,trim(p_content));
  if p_entry_type='diagnosis' then
    update public.suivi_patient_cases
    set initial_diagnosis=trim(p_content),updated_at=now()
    where id=p_case_id and professional_user_id=v_professional and status='active';
  end if;
end;
$$;

revoke all on function public.suivi_set_patient_case_status(uuid,text) from public,anon;
revoke all on function public.suivi_add_clinical_entry(uuid,text,text) from public,anon;
grant execute on function public.suivi_set_patient_case_status(uuid,text) to authenticated;
grant execute on function public.suivi_add_clinical_entry(uuid,text,text) to authenticated;

commit;
