-- NAXA 080 — contrôles structurels du bootstrap premier administrateur.
begin;
do $test$
declare
  source text;
  fn regprocedure;
begin
  fn := to_regprocedure('public.naxa_bootstrap_first_admin(uuid)');
  if fn is null then
    raise exception 'Fonction de bootstrap du premier administrateur absente';
  end if;

  select pg_get_functiondef(fn) into source;
  if position('naxa.home@gmail.com' in lower(source)) = 0 then
    raise exception 'La liste blanche email est absente';
  end if;
  if position('email_confirmed_at' in source) = 0 then
    raise exception 'La confirmation email n’est pas vérifiée';
  end if;
  if position('pg_advisory_xact_lock' in source) = 0 then
    raise exception 'Le verrou transactionnel anti-concurrence est absent';
  end if;
  if position('where p.role = ''admin''' in source) = 0 then
    raise exception 'Le contrôle d’un administrateur existant est absent';
  end if;

  if has_function_privilege('anon', fn, 'EXECUTE')
     or has_function_privilege('authenticated', fn, 'EXECUTE') then
    raise exception 'Le bootstrap est exécutable par un rôle public';
  end if;
end;
$test$;
select true as naxa_080_first_admin_bootstrap_pass;
rollback;
