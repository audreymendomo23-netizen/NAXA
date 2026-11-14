-- NAXA — preuve des projections Assurance publiques sans accès aux colonnes internes.
do $test$
declare
  v_assureurs_options text[];
  v_conventions_options text[];
begin
  select reloptions into v_assureurs_options
  from pg_class where oid='public.marketplace_assureurs'::regclass;
  select reloptions into v_conventions_options
  from pg_class where oid='public.marketplace_assurance_conventions'::regclass;

  if not (coalesce(v_assureurs_options,'{}') @> array['security_barrier=true','security_invoker=true']) then
    raise exception 'marketplace_assureurs doit être security_barrier + security_invoker';
  end if;
  if not (coalesce(v_conventions_options,'{}') @> array['security_barrier=true'])
     or coalesce(v_conventions_options,'{}') @> array['security_invoker=true'] then
    raise exception 'marketplace_assurance_conventions doit rester une projection security_barrier contrôlée';
  end if;

  if not has_table_privilege('anon','public.marketplace_assureurs','SELECT')
     or not has_table_privilege('anon','public.marketplace_assurance_conventions','SELECT') then
    raise exception 'Les vues publiques doivent rester lisibles par anon';
  end if;

  if not has_column_privilege('anon','public.assureurs','id','SELECT')
     or not has_column_privilege('anon','public.assureurs','nom','SELECT')
     or not has_column_privilege('anon','public.assureurs','code','SELECT')
     or not has_column_privilege('anon','public.assureurs','actif','SELECT')
     or has_column_privilege('anon','public.assureurs','nom_normalise','SELECT') then
    raise exception 'ACL assureurs trop large ou incomplète';
  end if;

  if not has_column_privilege('anon','public.assurance_conventions','pharmacie_id','SELECT')
     or not has_column_privilege('anon','public.assurance_conventions','assureur_id','SELECT')
     or not has_column_privilege('anon','public.assurance_conventions','date_debut','SELECT')
     or not has_column_privilege('anon','public.assurance_conventions','date_fin','SELECT') then
    raise exception 'Colonnes publiques convention non accordées';
  end if;
  if has_table_privilege('anon','public.assurance_conventions','SELECT')
     or has_column_privilege('anon','public.assurance_conventions','reference_convention','SELECT')
     or has_column_privilege('anon','public.assurance_conventions','cree_par','SELECT')
     or has_column_privilege('anon','public.assurance_conventions','created_at','SELECT')
     or has_column_privilege('anon','public.assurance_conventions','statut','SELECT') then
    raise exception 'Une colonne/table interne de convention est exposée à anon';
  end if;

  if not exists(select 1 from pg_policies
    where schemaname='public' and tablename='assureurs'
      and policyname='assureurs_marketplace_public_read' and 'anon'::name = any(roles)) then
    raise exception 'Policy publique assureurs active manquante';
  end if;
  if not exists(select 1 from pg_policies
    where schemaname='public' and tablename='assurance_conventions'
      and policyname='assurance_conventions_marketplace_public_read' and 'anon'::name = any(roles)) then
    raise exception 'Policy conventions Marketplace manquante';
  end if;
end;
$test$;

begin;
set local role anon;
select count(*)::int as assureurs_publics
from public.marketplace_assureurs;
select count(*)::int as conventions_publiques
from public.marketplace_assurance_conventions;
rollback;
