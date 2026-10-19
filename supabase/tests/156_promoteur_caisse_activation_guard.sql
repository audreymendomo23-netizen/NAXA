-- NAXA 156 — test structurel de la garde d'activation Promoteur/Caisse.
begin;

do $test$
declare
  v_definition text;
  v_security_definer boolean;
  v_trigger_definition text;
begin
  select pg_get_functiondef(p.oid), p.prosecdef
    into v_definition, v_security_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'naxa_guard_promoteur_caisse_activation'
    and pg_get_function_identity_arguments(p.oid) = '';

  if v_definition is null then
    raise exception 'Garde naxa_guard_promoteur_caisse_activation absente';
  end if;
  if not v_security_definer then
    raise exception 'La garde doit être SECURITY DEFINER';
  end if;
  if position('set search_path' in lower(v_definition)) = 0
     or position('auth.uid()' in v_definition) = 0
     or position('public.naxa_promoteur_valide' in v_definition) = 0
     or position('public.promoteur_pharmacies' in v_definition) = 0
     or position('public.pharmacies' in v_definition) = 0
     or position('visible_recherche = true' in v_definition) = 0
     or position('new.parent_profile_id' in v_definition) = 0 then
    raise exception 'Un contrôle d’identité, validité, parent, réseau ou publication manque';
  end if;

  select pg_get_triggerdef(t.oid)
    into v_trigger_definition
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'profiles'
    and t.tgname = 'trg_naxa_guard_promoteur_caisse_activation'
    and not t.tgisinternal;

  if v_trigger_definition is null then
    raise exception 'Déclencheur de garde Caisse absent';
  end if;
  if position('BEFORE' in upper(v_trigger_definition)) = 0
     or position('INSERT' in upper(v_trigger_definition)) = 0
     or position('UPDATE' in upper(v_trigger_definition)) = 0 then
    raise exception 'Le déclencheur doit intercepter insertions et mises à jour';
  end if;
end
$test$;

rollback;
