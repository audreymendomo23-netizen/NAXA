-- NAXA 078 — permettre la finalisation des profils client OAuth historiques incomplets.
begin;

create or replace function public.naxa_complete_google_profile(
  p_username text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_phone_country text,
  p_date_of_birth date,
  p_consent_accepted boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_username text := lower(trim(coalesce(p_username, '')));
  v_first_name text := trim(coalesce(p_first_name, ''));
  v_last_name text := trim(coalesce(p_last_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_country text := upper(trim(coalesce(p_phone_country, '')));
  v_role text;
  v_complete boolean;
  v_has_profile boolean := false;
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if coalesce(auth.jwt()->'app_metadata'->>'provider', '') <> 'google' then
    raise exception 'Cette procédure est réservée aux comptes Google';
  end if;

  select role::text,
         username is not null and first_name is not null and last_name is not null
         and phone is not null and date_of_birth is not null
         and age_verified and consent_accepted_at is not null
    into v_role, v_complete
    from public.profiles where id = v_user;
  v_has_profile := found;

  if v_has_profile and v_role <> 'client' then
    raise exception 'Seul un profil client peut être complété ici';
  end if;
  if v_has_profile and coalesce(v_complete,false) then
    raise exception 'Profil déjà complet';
  end if;
  if v_username !~ '^[a-z0-9][a-z0-9._-]{2,29}$' then
    raise exception 'Nom d''utilisateur invalide';
  end if;
  if exists (select 1 from public.profiles where lower(username) = v_username and id <> v_user) then
    raise exception 'Nom d''utilisateur déjà pris';
  end if;
  if length(v_first_name) < 2 or length(v_first_name) > 80 then raise exception 'Prénom invalide'; end if;
  if length(v_last_name) < 2 or length(v_last_name) > 80 then raise exception 'Nom invalide'; end if;
  if p_date_of_birth is null or p_date_of_birth > current_date
     or extract(year from age(current_date, p_date_of_birth)) < 18 then
    raise exception 'NAXA est réservé aux personnes âgées de 18 ans ou plus';
  end if;
  if p_consent_accepted is distinct from true then
    raise exception 'L''acceptation explicite des conditions est obligatoire';
  end if;
  if v_country not in ('CM','CF','TD','CG','CD','GQ','GA','ST','AO','BI','RW')
     or not private.naxa_phone_valid_for_country(v_country, v_phone) then
    raise exception 'Pays ou numéro de téléphone invalide';
  end if;

  if v_has_profile then
    update public.profiles
       set username = v_username,
           first_name = v_first_name,
           last_name = v_last_name,
           phone = v_phone,
           phone_country = v_country,
           date_of_birth = p_date_of_birth,
           age_verified = true,
           consent_accepted_at = now()
     where id = v_user and role = 'client';
  else
    insert into public.profiles(
      id, role, username, first_name, last_name, phone, phone_country,
      date_of_birth, age_verified, consent_accepted_at
    )
    values (
      v_user, 'client', v_username, v_first_name, v_last_name, v_phone, v_country,
      p_date_of_birth, true, now()
    );
  end if;
  return true;
end;
$function$;

revoke all on function public.naxa_complete_google_profile(text,text,text,text,text,date,boolean)
  from public, anon;
grant execute on function public.naxa_complete_google_profile(text,text,text,text,text,date,boolean)
  to authenticated;

commit;
