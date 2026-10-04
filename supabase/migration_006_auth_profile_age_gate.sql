-- NAXA — profil client, nom d'utilisateur, téléphone et validation d'âge
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists phone text,
  add column if not exists phone_country text,
  add column if not exists date_of_birth date,
  add column if not exists age_verified boolean not null default false,
  add column if not exists consent_accepted_at timestamptz;

create unique index if not exists profiles_username_lower_unique
  on public.profiles(lower(username))
  where username is not null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_username text:=lower(trim(new.raw_user_meta_data->>'username'));
  v_first_name text:=trim(new.raw_user_meta_data->>'first_name');
  v_last_name text:=trim(new.raw_user_meta_data->>'last_name');
  v_phone text:=trim(new.raw_user_meta_data->>'phone');
  v_country text:=upper(trim(new.raw_user_meta_data->>'phone_country'));
  v_dob date:=(new.raw_user_meta_data->>'date_of_birth')::date;
  v_consent boolean:=coalesce((new.raw_user_meta_data->>'consent_accepted')::boolean,false);
begin
  if v_username is null or v_username!~'^[a-z0-9][a-z0-9._-]{2,29}$' then raise exception 'Nom d''utilisateur invalide'; end if;
  if exists(select 1 from public.profiles where lower(username)=v_username) then raise exception 'Nom d''utilisateur déjà pris'; end if;
  if v_first_name is null or length(v_first_name)<2 or length(v_first_name)>80 then raise exception 'Prénom invalide'; end if;
  if v_last_name is null or length(v_last_name)<2 or length(v_last_name)>80 then raise exception 'Nom invalide'; end if;
  if v_dob is null or v_dob>current_date or extract(year from age(current_date,v_dob))<18 then raise exception 'NAXA est réservé aux personnes âgées de 18 ans ou plus'; end if;
  if not v_consent then raise exception 'L''acceptation des conditions est obligatoire'; end if;

  if v_country='CM' and v_phone!~'^\+237[0-9]{9}$' then raise exception 'Numéro de téléphone camerounais invalide';
  elsif v_country='CF' and v_phone!~'^\+236[0-9]{8}$' then raise exception 'Numéro de téléphone centrafricain invalide';
  elsif v_country='TD' and v_phone!~'^\+235[0-9]{8}$' then raise exception 'Numéro de téléphone tchadien invalide';
  elsif v_country='CG' and v_phone!~'^\+242[0-9]{9}$' then raise exception 'Numéro de téléphone congolais invalide';
  elsif v_country='CD' and v_phone!~'^\+243[0-9]{9}$' then raise exception 'Numéro de téléphone congolais (RDC) invalide';
  elsif v_country='GQ' and v_phone!~'^\+240[0-9]{9}$' then raise exception 'Numéro de téléphone équato-guinéen invalide';
  elsif v_country='GA' and v_phone!~'^\+241[0-9]{8}$' then raise exception 'Numéro de téléphone gabonais invalide';
  elsif v_country='ST' and v_phone!~'^\+239[0-9]{7}$' then raise exception 'Numéro de téléphone santoméen invalide';
  elsif v_country='AO' and v_phone!~'^\+244[0-9]{9}$' then raise exception 'Numéro de téléphone angolais invalide';
  elsif v_country='BI' and v_phone!~'^\+257[0-9]{8}$' then raise exception 'Numéro de téléphone burundais invalide';
  elsif v_country='RW' and v_phone!~'^\+250[0-9]{9}$' then raise exception 'Numéro de téléphone rwandais invalide';
  else raise exception 'Pays ou numéro de téléphone invalide';
  end if;

  insert into public.profiles(id,role,username,first_name,last_name,phone,phone_country,date_of_birth,age_verified,consent_accepted_at)
  values(new.id,'client',v_username,v_first_name,v_last_name,v_phone,v_country,v_dob,true,now());
  return new;
end;
$$;

create or replace function public.is_age_verified()
returns boolean language sql stable security definer set search_path=''
as $$select exists(select 1 from public.profiles where id=(select auth.uid()) and age_verified=true)$$;
revoke execute on function public.is_age_verified() from public,anon,authenticated;
