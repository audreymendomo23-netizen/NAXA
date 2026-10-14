-- NAXA 088 — réaligne le trigger Auth si une base a marqué la migration 085 comme appliquée
-- alors que la définition réelle de handle_new_user() est restée ancienne.
-- Migration additive et idempotente : ne modifie ni les profils existants ni les utilisateurs.
begin;

create schema if not exists private;

create or replace function private.naxa_phone_valid_for_country(
  p_country text,
  p_phone text
)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $function$
  select case upper(trim(coalesce(p_country, '')))
    when 'CM' then coalesce(trim(p_phone), '') ~ '^\+237[0-9]{9}$'
    when 'CF' then coalesce(trim(p_phone), '') ~ '^\+236[0-9]{8}$'
    when 'TD' then coalesce(trim(p_phone), '') ~ '^\+235[0-9]{8}$'
    when 'CG' then coalesce(trim(p_phone), '') ~ '^\+242[0-9]{9}$'
    when 'CD' then coalesce(trim(p_phone), '') ~ '^\+243[0-9]{9}$'
    when 'GQ' then coalesce(trim(p_phone), '') ~ '^\+240[0-9]{9}$'
    when 'GA' then coalesce(trim(p_phone), '') ~ '^\+241[0-9]{8}$'
    when 'ST' then coalesce(trim(p_phone), '') ~ '^\+239[0-9]{7}$'
    when 'AO' then coalesce(trim(p_phone), '') ~ '^\+244[0-9]{9}$'
    when 'BI' then coalesce(trim(p_phone), '') ~ '^\+257[0-9]{8}$'
    when 'RW' then coalesce(trim(p_phone), '') ~ '^\+250[0-9]{9}$'
    else false
  end
$function$;

revoke all on function private.naxa_phone_valid_for_country(text, text)
  from public, anon, authenticated;

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
  -- Le flux OTP d'inscription crée seulement l'identité Auth provisoire.
  -- Aucune donnée personnelle du formulaire ni aucun profil NAXA ne sont écrits ici.
  if coalesce(new.raw_user_meta_data->>'naxa_signup_pending', 'false') = 'true' then
    return new;
  end if;

  -- Google peut créer l'identité Auth, mais l'onboarding reste obligatoire.
  if new.raw_app_meta_data->>'provider' = 'google'
     and (
       v_username is null or v_first_name is null or v_last_name is null
       or v_phone is null or v_country is null or v_dob is null or not v_consent
     ) then
    return new;
  end if;

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

commit;
