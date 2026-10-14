-- NAXA 088 — le trigger réaligné ne crée aucun profil avant finalisation.
begin;

create temporary table naxa_test_auth_user (
  id uuid,
  email text,
  raw_user_meta_data jsonb,
  raw_app_meta_data jsonb
);

create trigger naxa_test_pending_user
after insert on naxa_test_auth_user
for each row execute function public.handle_new_user();

insert into naxa_test_auth_user(id, email, raw_user_meta_data, raw_app_meta_data)
values (
  'd0000000-0000-4000-8000-000000000088',
  'not-an-email',
  '{"naxa_signup_pending": true}'::jsonb,
  '{}'::jsonb
);

do $naxa088$
begin
  if exists (
    select 1 from public.profiles
    where id = 'd0000000-0000-4000-8000-000000000088'
  ) then
    raise exception 'Échec NAXA 088 : un profil a été créé avant la validation OTP et du mot de passe';
  end if;
end;
$naxa088$;

select true as naxa_088_signup_pending_no_profile_pass;
rollback;
