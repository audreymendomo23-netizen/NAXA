-- NAXA: réappliquer le garde-fou d'inscription provisoire sur les bases déjà déployées.
-- Le trigger Auth doit accepter l'identité provisoire OTP sans exiger le profil final.
-- Aucun profil ni donnée personnelle n'est créé tant que naxa_signup_pending=true.

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
  -- IMPORTANT: cette branche doit précéder toute validation du formulaire.
  -- Supabase crée l'identité Auth lors de l'envoi du code OTP ; le profil
  -- NAXA n'est finalisé qu'après vérification du code et du formulaire complet.
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
