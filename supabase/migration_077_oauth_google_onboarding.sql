-- NAXA 077 — onboarding Google sans contournement de l'âge ni du consentement.
begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_username text := lower(trim(new.raw_user_meta_data->>'username'));
  v_first_name text := trim(new.raw_user_meta_data->>'first_name');
  v_last_name text := trim(new.raw_user_meta_data->>'last_name');
  v_phone text := trim(new.raw_user_meta_data->>'phone');
  v_country text := upper(trim(new.raw_user_meta_data->>'phone_country'));
  v_dob date := nullif(new.raw_user_meta_data->>'date_of_birth', '')::date;
  v_consent boolean := coalesce((new.raw_user_meta_data->>'consent_accepted')::boolean, false);
begin
  -- Google ne fournit pas les données NAXA exigées. Créer l'identité Auth sans
  -- profil applicatif; l'application la bloque jusqu'à l'onboarding explicite.
  if new.raw_app_meta_data->>'provider' = 'google'
     and (
       v_username is null or v_first_name is null or v_last_name is null
       or v_phone is null or v_country is null or v_dob is null or not v_consent
     ) then
    return new;
  end if;

  -- L'inscription e-mail conserve les validations strictes existantes.
  if v_username is null or v_username !~ '^[a-z0-9][a-z0-9._-]{2,29}$' then
    raise exception 'Nom d''utilisateur invalide';
  end if;
  if exists (select 1 from public.profiles where lower(username) = v_username) then
    raise exception 'Nom d''utilisateur déjà pris';
  end if;
  if v_first_name is null or length(v_first_name) < 2 or length(v_first_name) > 80 then
    raise exception 'Prénom invalide';
  end if;
  if v_last_name is null or length(v_last_name) < 2 or length(v_last_name) > 80 then
    raise exception 'Nom invalide';
  end if;
  if v_dob is null or v_dob > current_date or extract(year from age(current_date, v_dob)) < 18 then
    raise exception 'NAXA est réservé aux personnes âgées de 18 ans ou plus';
  end if;
  if not v_consent then
    raise exception 'L''acceptation des conditions est obligatoire';
  end if;
  if v_country is null or v_country not in ('CM','CF','TD','CG','CD','GQ','GA','ST','AO','BI','RW') then
    raise exception 'Pays non pris en charge';
  end if;
  if not private.naxa_phone_valid_for_country(v_country, v_phone) then
    raise exception 'Numéro de téléphone invalide pour le pays sélectionné';
  end if;

  insert into public.profiles(
    id, role, username, first_name, last_name, phone, phone_country,
    date_of_birth, age_verified, consent_accepted_at
  )
  values (
    new.id, 'client', v_username, v_first_name, v_last_name, v_phone, v_country,
    v_dob, true, now()
  );
  return new;
end;
$function$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

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
begin
  if v_user is null then raise exception 'Connexion requise'; end if;
  if coalesce(auth.jwt()->'app_metadata'->>'provider', '') <> 'google' then
    raise exception 'Cette procédure est réservée aux comptes Google';
  end if;
  if exists (select 1 from public.profiles where id = v_user) then
    raise exception 'Profil déjà initialisé';
  end if;
  if v_username !~ '^[a-z0-9][a-z0-9._-]{2,29}$' then
    raise exception 'Nom d''utilisateur invalide';
  end if;
  if exists (select 1 from public.profiles where lower(username) = v_username) then
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

  insert into public.profiles(
    id, role, username, first_name, last_name, phone, phone_country,
    date_of_birth, age_verified, consent_accepted_at
  )
  values (
    v_user, 'client', v_username, v_first_name, v_last_name, v_phone, v_country,
    p_date_of_birth, true, now()
  );
  return true;
end;
$function$;

revoke all on function public.naxa_complete_google_profile(text,text,text,text,text,date,boolean)
  from public, anon;
grant execute on function public.naxa_complete_google_profile(text,text,text,text,text,date,boolean)
  to authenticated;

commit;
