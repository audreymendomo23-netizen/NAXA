alter table public.profiles
  add column if not exists age_verified boolean not null default false;

create or replace function public.verify_age(p_birth_date date)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_age int;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;

  if p_birth_date is null or p_birth_date > current_date then
    raise exception 'Date de naissance invalide';
  end if;

  v_age := extract(year from age(current_date, p_birth_date))::int;
  if v_age < 18 then
    raise exception 'Âge minimum requis';
  end if;

  update public.profiles
     set age_verified = true
   where id = auth.uid();

  return true;
end;
$$;

revoke execute on function public.verify_age(date) from public, anon;
grant execute on function public.verify_age(date) to authenticated;
