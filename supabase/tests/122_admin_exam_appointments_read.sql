-- NAXA 122 — contrôle du contrat courant de lecture Admin des tickets d'examens.
-- Le prédicat RLS délègue au garde canonique public.is_admin(), qui vérifie
-- auth.uid(), profiles.role='admin' et profiles.actif=true via private.is_admin().
-- Exécuter sur Replay ; transaction annulée à la fin.
begin;

do $test$
declare
  policy_row record;
  public_admin_def text;
  private_admin_def text;
begin
  select schemaname, tablename, policyname, roles, cmd, qual
    into policy_row
  from pg_policies
  where schemaname = 'public'
    and tablename = 'exam_appointments'
    and policyname = 'exam_appointments_admin_read';

  if not found then
    raise exception 'Politique exam_appointments_admin_read absente';
  end if;

  if policy_row.cmd <> 'SELECT' then
    raise exception 'La politique administrative doit être limitée à SELECT';
  end if;

  if not ('authenticated' = any(policy_row.roles)) then
    raise exception 'La politique doit viser le rôle authenticated';
  end if;

  if coalesce(policy_row.qual, '') not ilike '%is_admin%' then
    raise exception 'La politique doit déléguer au garde canonique is_admin()';
  end if;

  if not (
    select relrowsecurity
    from pg_class
    where oid = 'public.exam_appointments'::regclass
  ) then
    raise exception 'RLS doit rester activée sur exam_appointments';
  end if;

  select pg_get_functiondef('public.is_admin()'::regprocedure)
    into public_admin_def;
  if public_admin_def not ilike '%private.is_admin()%' then
    raise exception 'public.is_admin() doit déléguer au garde privé canonique';
  end if;

  select pg_get_functiondef('private.is_admin()'::regprocedure)
    into private_admin_def;
  if private_admin_def not ilike '%role = ''admin''%'
     or private_admin_def not ilike '%actif is true%'
     or private_admin_def not ilike '%auth.uid()%' then
    raise exception 'Le garde privé doit exiger une identité, le rôle admin et le profil actif';
  end if;
end;
$test$;

select true as naxa_122_admin_exam_appointments_read_pass;
rollback;
