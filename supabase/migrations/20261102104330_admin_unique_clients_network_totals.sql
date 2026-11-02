-- NAXA — étape 13 : dédoublonnage des clients entre pharmacies.
-- Les totaux réseau et Promoteur comptent chaque client une seule fois dans leur périmètre.
-- Les métriques détaillées par pharmacie restent des clients distincts dans chaque pharmacie.

create or replace function public.admin_comptes_indicateurs(p_jours integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_data jsonb;
  v_debut timestamptz;
  v_clients bigint := 0;
  v_ids uuid[];
  v_prom record;
begin
  -- Le moteur privé impose déjà auth.uid(), role=admin et actif=true.
  -- Il est appelé avant toute lecture complémentaire : les refus sont conservés.
  v_data := private.admin_comptes_indicateurs(p_jours);
  v_debut := (v_data->'periode'->>'du')::timestamptz;

  -- Total réseau : un même client ayant réservé dans plusieurs pharmacies ne compte qu'une fois.
  select count(distinct r.client_id)::bigint
  into v_clients
  from public.reservations r
  join public.pharmacies ph on ph.id = r.pharmacie_id
  where ph.est_demo is not true
    and r.created_at >= v_debut;

  v_data := jsonb_set(
    v_data,
    '{totaux,clients_avec_reservation}',
    to_jsonb(coalesce(v_clients, 0)),
    true
  );

  -- Chaque Promoteur compte les clients distincts sur l'union de ses rattachements actifs.
  -- Les pharmacies démo sont exclues comme dans le moteur réseau.
  for v_prom in
    select e.value as payload, e.ordinality
    from jsonb_array_elements(coalesce(v_data->'par_promoteur','[]'::jsonb))
      with ordinality as e(value, ordinality)
  loop
    select coalesce(array_agg(pp.pharmacie_id order by pp.pharmacie_id), '{}'::uuid[])
    into v_ids
    from public.promoteur_pharmacies pp
    join public.pharmacies ph on ph.id = pp.pharmacie_id
    where pp.promoteur_id = (v_prom.payload->>'id')::uuid
      and pp.actif is true
      and ph.est_demo is not true;

    select count(distinct r.client_id)::bigint
    into v_clients
    from public.reservations r
    where r.pharmacie_id = any(v_ids)
      and r.created_at >= v_debut;

    v_data := jsonb_set(
      v_data,
      array[
        'par_promoteur',
        (v_prom.ordinality - 1)::text,
        'indicateurs',
        'clients_avec_reservation'
      ],
      to_jsonb(coalesce(v_clients, 0)),
      true
    );
  end loop;

  return v_data || jsonb_build_object(
    'partenaires_globaux',
    private.admin_partners_summary()
  );
end;
$$;

revoke all on function public.admin_comptes_indicateurs(integer) from public, anon, authenticated;
grant execute on function public.admin_comptes_indicateurs(integer) to authenticated;

comment on function public.admin_comptes_indicateurs(integer) is
  'Indicateurs agrégés des comptes professionnels et clients par pharmacie et Promoteur, avec comptes Partenaires Marketplace séparés. Les clients sont dédoublonnés dans les totaux réseau et par Promoteur. Accès réservé à un Admin actif; aucune donnée client nominative ni donnée de santé n''est retournée.';
