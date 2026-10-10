-- NAXA 066 — contrôle de la correction additive des contraintes et de la RLS.
begin;

do $naxa066$
declare
  v_count integer;
begin
  if exists (
    select 1 from pg_constraint
    where conrelid='public.profiles'::regclass
      and conname in ('profiles_fonction_interne_ck','profiles_niveau_hierarchique_ck')
  ) then
    raise exception 'Contraintes CHECK historiques incompatibles encore présentes';
  end if;

  if not (select relrowsecurity from pg_class where oid='public.abonnements'::regclass) then
    raise exception 'RLS non activée sur public.abonnements';
  end if;

  if not (select relrowsecurity from pg_class where oid='public.naxa_architecture_niveaux'::regclass) then
    raise exception 'RLS non activée sur public.naxa_architecture_niveaux';
  end if;

  select count(*) into v_count
  from pg_policies
  where schemaname='public'
    and (
      (tablename='abonnements' and policyname='abonnements_admin_only')
      or (tablename='naxa_architecture_niveaux' and policyname in ('naxa_architecture_niveaux_read','naxa_architecture_niveaux_admin_write'))
    );

  if v_count <> 3 then
    raise exception 'Politiques RLS attendues=3, obtenues=%',v_count;
  end if;

  if position('abonnements_promoteurs' in pg_get_functiondef('private.naxa_promoteur_valide(uuid)'::regprocedure)) = 0 then
    raise exception 'Validité Promoteur ne référence pas l''abonnement canonique réseau';
  end if;

  if position('return p_privilege like ''VIEW_%''' in pg_get_functiondef('public.naxa_can(text,uuid,uuid)'::regprocedure)) = 0 then
    raise exception 'naxa_can ne gère pas les capacités de lecture sans cible';
  end if;
end;
$naxa066$;

select true as naxa_066_constraints_and_rls_pass;
rollback;
