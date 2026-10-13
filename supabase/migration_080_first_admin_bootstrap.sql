-- NAXA 080 — bootstrap transactionnel du premier administrateur.
-- Le compte doit d'abord exister dans Auth et avoir une adresse confirmée.
-- L'appel HTTP reste protégé par NAXA_ADMIN_BOOTSTRAP_SECRET côté serveur.
begin;

create or replace function public.naxa_bootstrap_first_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_email text;
  v_confirmed_at timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext('naxa:first-admin-bootstrap'));

  select lower(trim(u.email)), u.email_confirmed_at
    into v_email, v_confirmed_at
  from auth.users u
  where u.id = p_user_id
  for update;

  if not found then
    raise exception 'Le compte Auth doit être créé avant le bootstrap';
  end if;
  if v_email is distinct from 'naxa.home@gmail.com' then
    raise exception 'Adresse non autorisée pour le premier administrateur';
  end if;
  if v_confirmed_at is null then
    raise exception 'L’adresse email doit être confirmée avant le bootstrap';
  end if;
  if exists (select 1 from public.profiles p where p.role = 'admin') then
    raise exception 'Un administrateur existe déjà';
  end if;

  update public.profiles set role = 'admin' where id = p_user_id;
  if not found then
    raise exception 'Profil NAXA introuvable pour ce compte';
  end if;
end;
$function$;

revoke all on function public.naxa_bootstrap_first_admin(uuid) from public, anon, authenticated;
grant execute on function public.naxa_bootstrap_first_admin(uuid) to service_role;

commit;
