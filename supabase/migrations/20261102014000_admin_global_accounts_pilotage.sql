-- NAXA — Étape 13 : consolidation chiffrée des autres comptes par pharmacie et Promoteur.
-- Le moteur est privé, lecture seule et réservé à un Admin actif.
-- Les périmètres Promoteur utilisent uniquement les rattachements promoteur_pharmacies actifs.
-- Les sources facultatives absentes sont renvoyées à NULL et signalées dans "sources" (jamais converties en zéro).

create or replace function private.admin_pharmacy_account_metrics(
  p_pharmacie uuid,
  p_jours integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_debut timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_jours,30),365)));
  v_limite date := (current_date + 30);
  v_preparations bigint := null;
  v_audit_pharmacien bigint := null;
  v_affectations bigint := null;
  v_controles_comptables bigint := null;
  v_evenements_comptables bigint := null;
  v_periodes_comptables bigint := null;
  v_ecritures_comptables bigint := null;
begin
  if p_pharmacie is null then
    raise exception 'Pharmacie requise';
  end if;

  if to_regclass('public.prescription_preparations') is not null then
    execute 'select count(*) from public.prescription_preparations where pharmacie_id = $1 and updated_at >= $2'
      into v_preparations using p_pharmacie, v_debut;
  end if;

  if to_regclass('public.pharmacien_audit_events') is not null then
    execute 'select count(*) from public.pharmacien_audit_events where pharmacie_id = $1 and occurred_at >= $2'
      into v_audit_pharmacien using p_pharmacie, v_debut;
  end if;

  if to_regclass('public.naxa_professional_assignments') is not null then
    execute 'select count(*) from public.naxa_professional_assignments
      where pharmacie_id = $1 and statut = ''active''
        and commence_at <= now() and expire_at > now()'
      into v_affectations using p_pharmacie;
  end if;

  if to_regclass('public.compta_controles_cloture') is not null then
    execute 'select count(*) from public.compta_controles_cloture where pharmacie_id = $1 and statut = ''a_controler'''
      into v_controles_comptables using p_pharmacie;
  end if;

  if to_regclass('public.compta_evenement') is not null then
    execute 'select count(*) from public.compta_evenement
      where pharmacie_id = $1 and statut in (''a_traiter'',''en_cours'',''erreur'') and created_at >= $2'
      into v_evenements_comptables using p_pharmacie, v_debut;
  end if;

  if to_regclass('public.compta_periodes') is not null then
    execute 'select count(*) from public.compta_periodes where pharmacie_id = $1 and statut = ''ouverte'''
      into v_periodes_comptables using p_pharmacie;
  end if;

  if to_regclass('public.compta_ecriture') is not null then
    execute 'select count(*) from public.compta_ecriture where pharmacie_id = $1 and created_at >= $2'
      into v_ecritures_comptables using p_pharmacie, v_debut;
  end if;

  return jsonb_build_object(
    'comptes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'role', x.role,
        'fonction_interne', coalesce(x.fonction_interne,'(aucune)'),
        'actif', x.actif,
        'total', x.total
      ) order by x.role, x.fonction_interne, x.actif)
      from (
        select p.role::text as role, p.fonction_interne, p.actif, count(*)::integer as total
        from public.profiles p
        where p.pharmacie_id = p_pharmacie
        group by p.role, p.fonction_interne, p.actif
      ) x
    ), '[]'::jsonb),
    'indicateurs', jsonb_build_object(
      'clients_avec_reservation', (
        select count(distinct r.client_id)::bigint
        from public.reservations r
        where r.pharmacie_id = p_pharmacie and r.created_at >= v_debut
      ),
      'reservations', (
        select count(*)::bigint from public.reservations r
        where r.pharmacie_id = p_pharmacie and r.created_at >= v_debut
      ),
      'ventes_marketplace', (
        select coalesce(sum(v.ventes),0)::bigint from public.v_reservations_ca v
        where v.pharmacie_id = p_pharmacie and v.jour >= v_debut::date
      ),
      'ca_marketplace_fcfa', (
        select coalesce(sum(v.total),0)::numeric from public.v_reservations_ca v
        where v.pharmacie_id = p_pharmacie and v.jour >= v_debut::date
      ),
      'ventes_pos_payees', (
        select count(*)::bigint from public.ventes v
        where v.pharmacie_id = p_pharmacie and v.statut::text = 'payee'
          and coalesce(v.paid_at,v.created_at) >= v_debut
      ),
      'ca_pos_fcfa', (
        select coalesce(sum(v.total_net),0)::numeric from public.ventes v
        where v.pharmacie_id = p_pharmacie and v.statut::text = 'payee'
          and coalesce(v.paid_at,v.created_at) >= v_debut
      ),
      'references_stock', (
        select count(*)::bigint from public.stocks s where s.pharmacie_id = p_pharmacie
      ),
      'stocks_bas', (
        select count(*)::bigint from public.stocks s where s.pharmacie_id = p_pharmacie and s.quantite <= 5
      ),
      'ruptures_stock', (
        select count(*)::bigint from public.stocks s where s.pharmacie_id = p_pharmacie and s.quantite = 0
      ),
      'lots_a_controler', (
        select count(*)::bigint from public.stocks_lots l
        where l.pharmacie_id = p_pharmacie
          and (l.bloque = true or l.date_peremption is null or l.date_peremption <= v_limite)
      ),
      'inventaires_ouverts', (
        select count(*)::bigint from public.inventaires i
        where i.pharmacie_id = p_pharmacie and i.statut::text in ('brouillon','en_cours')
      ),
      'consultations_pharmaceutiques', (
        select count(*)::bigint from public.consultations_pharmaceutiques c
        where c.pharmacie_id = p_pharmacie and c.created_at >= v_debut
      ),
      'prescriptions', (
        select count(*)::bigint from public.prescriptions p
        where p.pharmacie_id = p_pharmacie and p.created_at >= v_debut
      ),
      'preparations_prescriptions', v_preparations,
      'evenements_audit_pharmacien', v_audit_pharmacien,
      'caisses_actives', (
        select count(*)::bigint from public.caisses c
        where c.pharmacie_id = p_pharmacie and c.actif = true
      ),
      'sessions_caisse', (
        select count(*)::bigint from public.caisses_sessions s
        join public.caisses c on c.id = s.caisse_id
        where c.pharmacie_id = p_pharmacie and s.ouvert_at >= v_debut
      ),
      'ecarts_caisse_a_verifier', (
        select count(*)::bigint from public.caisses_sessions s
        join public.caisses c on c.id = s.caisse_id
        where c.pharmacie_id = p_pharmacie
          and s.cloture_at >= v_debut and s.ecart_statut = 'a_verifier'
      ),
      'depenses', (
        select count(*)::bigint from public.depenses d
        where d.pharmacie_id = p_pharmacie and d.date_depense >= v_debut::date
      ),
      'montant_depenses_fcfa', (
        select coalesce(sum(d.montant),0)::numeric from public.depenses d
        where d.pharmacie_id = p_pharmacie and d.date_depense >= v_debut::date
      ),
      'mouvements_tresorerie', (
        select count(*)::bigint from public.tresorerie_mouvements t
        where t.pharmacie_id = p_pharmacie and t.date_operation >= v_debut
      ),
      'montant_tresorerie_brut_fcfa', (
        select coalesce(sum(t.montant),0)::numeric from public.tresorerie_mouvements t
        where t.pharmacie_id = p_pharmacie and t.date_operation >= v_debut
      ),
      'dossiers_assurance', (
        select count(*)::bigint from public.dossiers_assurance a
        where a.pharmacie_id = p_pharmacie and a.created_at >= v_debut
      ),
      'montant_prise_en_charge_fcfa', (
        select coalesce(sum(a.montant_prise_en_charge),0)::numeric from public.dossiers_assurance a
        where a.pharmacie_id = p_pharmacie and a.created_at >= v_debut
      ),
      'services_pharmacien_pointes', (
        select count(*)::bigint from public.pharmacien_service_sessions s
        where s.pharmacie_id = p_pharmacie and s.started_at >= v_debut
      ),
      'services_stock_pointes', (
        select count(*)::bigint from public.stock_service_sessions s
        where s.pharmacie_id = p_pharmacie and s.opened_at >= v_debut
      ),
      'affectations_professionnelles_actives', v_affectations,
      'controles_comptables_a_traiter', v_controles_comptables,
      'evenements_comptables_a_traiter', v_evenements_comptables,
      'periodes_comptables_ouvertes', v_periodes_comptables,
      'ecritures_comptables', v_ecritures_comptables
    )
  );
end;
$$;

create or replace function private.admin_comptes_indicateurs(p_jours integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_jours integer := greatest(1, least(coalesce(p_jours,30),365));
  v_debut timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_jours,30),365)));
  v_comptes jsonb;
  v_pharmacies jsonb := '[]'::jsonb;
  v_promoteurs jsonb := '[]'::jsonb;
  v_totaux jsonb := jsonb_build_object(
    'clients_avec_reservation',0,'reservations',0,'ventes_marketplace',0,'ca_marketplace_fcfa',0,
    'ventes_pos_payees',0,'ca_pos_fcfa',0,'references_stock',0,'stocks_bas',0,'ruptures_stock',0,
    'lots_a_controler',0,'inventaires_ouverts',0,'consultations_pharmaceutiques',0,'prescriptions',0,
    'preparations_prescriptions',null,'evenements_audit_pharmacien',null,
    'caisses_actives',0,'sessions_caisse',0,'ecarts_caisse_a_verifier',0,
    'depenses',0,'montant_depenses_fcfa',0,'mouvements_tresorerie',0,'montant_tresorerie_brut_fcfa',0,
    'dossiers_assurance',0,'montant_prise_en_charge_fcfa',0,
    'services_pharmacien_pointes',0,'services_stock_pointes',0,
    'affectations_professionnelles_actives',null,'controles_comptables_a_traiter',null,
    'evenements_comptables_a_traiter',null,'periodes_comptables_ouvertes',null,'ecritures_comptables',null
  );
  v_ph record;
  v_prom record;
  v_ph_metrics jsonb;
  v_prom_metrics jsonb;
  v_comptes_promoteur jsonb;
  v_ids uuid[];
  v_id uuid;
  v_key text;
  v_sources jsonb;
  v_total_pharmacies integer := 0;
  v_pharmacies_actives integer := 0;
  v_clients_total integer := 0;
  v_clients_actifs integer := 0;
  v_promoteurs_total integer := 0;
  v_promoteurs_actifs integer := 0;
  v_comptes_professionnels integer := 0;
begin
  if v_uid is null then raise exception 'Connexion requise'; end if;

  select p.role::text into v_role
  from public.profiles p
  where p.id = v_uid and p.actif = true;

  if v_role is distinct from 'admin' then
    raise exception 'Accès réservé à un administrateur actif';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'role',x.role,
    'fonction_interne',coalesce(x.fonction_interne,'(aucune)'),
    'actif',x.actif,
    'total',x.total
  ) order by x.role,x.fonction_interne,x.actif),'[]'::jsonb)
  into v_comptes
  from (
    select p.role::text as role,p.fonction_interne,p.actif,count(*)::integer as total
    from public.profiles p
    group by p.role,p.fonction_interne,p.actif
  ) x;

  select count(*)::integer,
         count(*) filter(where p.role::text='client')::integer,
         count(*) filter(where p.role::text='client' and p.actif)::integer,
         count(*) filter(where p.role::text='promoteur')::integer,
         count(*) filter(where p.role::text='promoteur' and p.actif)::integer,
         count(*) filter(where p.role::text not in ('admin','client'))::integer
  into v_comptes_professionnels,v_clients_total,v_clients_actifs,v_promoteurs_total,v_promoteurs_actifs,v_comptes_professionnels
  from public.profiles p;

  for v_ph in
    select ph.id,ph.nom,ph.actif
    from public.pharmacies ph
    where ph.est_demo is not true
    order by ph.nom,ph.id
  loop
    v_ph_metrics := private.admin_pharmacy_account_metrics(v_ph.id,v_jours);
    v_pharmacies := v_pharmacies || jsonb_build_array(jsonb_build_object(
      'id',v_ph.id,
      'nom',v_ph.nom,
      'actif',v_ph.actif,
      'promoteurs',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',p.id,
          'nom',coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),p.username,'Promoteur')
        ) order by p.id)
        from public.promoteur_pharmacies pp
        join public.profiles p on p.id=pp.promoteur_id and p.role::text='promoteur'
        where pp.pharmacie_id=v_ph.id and pp.actif=true
      ),'[]'::jsonb),
      'comptes',v_ph_metrics->'comptes',
      'indicateurs',v_ph_metrics->'indicateurs'
    ));

    v_totaux := jsonb_set(v_totaux,'{_pharmacies_total}',to_jsonb(coalesce((v_totaux->>'_pharmacies_total')::integer,0)+1),true);
    if v_ph.actif then
      v_pharmacies_actives := v_pharmacies_actives + 1;
    end if;
    v_total_pharmacies := v_total_pharmacies + 1;

    for v_key in select jsonb_object_keys(v_totaux) loop
      if left(v_key,1) <> '_' and v_ph_metrics->'indicateurs'->v_key is not null
         and v_ph_metrics->'indicateurs'->v_key <> 'null'::jsonb then
        v_totaux := jsonb_set(
          v_totaux,
          array[v_key],
          to_jsonb(coalesce((v_totaux->>v_key)::numeric,0) + (v_ph_metrics->'indicateurs'->>v_key)::numeric),
          true
        );
      end if;
    end loop;
  end loop;

  -- Un Promoteur agrège exclusivement ses rattachements actifs.
  -- Si une pharmacie a plusieurs rattachements Promoteur actifs, les périmètres Promoteur se chevauchent;
  -- le total réseau reste, lui, calculé une seule fois par pharmacie.
  for v_prom in
    select p.id,
      coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),p.username,'Promoteur') as nom,
      p.actif
    from public.profiles p
    where p.role::text='promoteur'
    order by nom,p.id
  loop
    select coalesce(array_agg(pp.pharmacie_id order by pp.pharmacie_id),'{}'::uuid[])
    into v_ids
    from public.promoteur_pharmacies pp
    join public.pharmacies ph on ph.id=pp.pharmacie_id and ph.est_demo is not true
    where pp.promoteur_id=v_prom.id and pp.actif=true;

    v_prom_metrics := jsonb_build_object(
      'clients_avec_reservation',0,'reservations',0,'ventes_marketplace',0,'ca_marketplace_fcfa',0,
      'ventes_pos_payees',0,'ca_pos_fcfa',0,'references_stock',0,'stocks_bas',0,'ruptures_stock',0,
      'lots_a_controler',0,'inventaires_ouverts',0,'consultations_pharmaceutiques',0,'prescriptions',0,
      'preparations_prescriptions',null,'evenements_audit_pharmacien',null,
      'caisses_actives',0,'sessions_caisse',0,'ecarts_caisse_a_verifier',0,
      'depenses',0,'montant_depenses_fcfa',0,'mouvements_tresorerie',0,'montant_tresorerie_brut_fcfa',0,
      'dossiers_assurance',0,'montant_prise_en_charge_fcfa',0,
      'services_pharmacien_pointes',0,'services_stock_pointes',0,
      'affectations_professionnelles_actives',null,'controles_comptables_a_traiter',null,
      'evenements_comptables_a_traiter',null,'periodes_comptables_ouvertes',null,'ecritures_comptables',null
    );

    foreach v_id in array v_ids loop
      select e.value->'indicateurs' into v_ph_metrics
      from jsonb_array_elements(v_pharmacies) e(value)
      where e.value->>'id'=v_id::text
      limit 1;

      if v_ph_metrics is not null then
        for v_key in select jsonb_object_keys(v_prom_metrics) loop
          if v_ph_metrics->v_key is not null and v_ph_metrics->v_key <> 'null'::jsonb then
            v_prom_metrics := jsonb_set(
              v_prom_metrics,
              array[v_key],
              to_jsonb(coalesce((v_prom_metrics->>v_key)::numeric,0)+(v_ph_metrics->>v_key)::numeric),
              true
            );
          end if;
        end loop;
      end if;
    end loop;

    select coalesce(jsonb_agg(jsonb_build_object(
      'role',x.role,
      'fonction_interne',coalesce(x.fonction_interne,'(aucune)'),
      'actif',x.actif,
      'total',x.total
    ) order by x.role,x.fonction_interne,x.actif),'[]'::jsonb)
    into v_comptes_promoteur
    from (
      select p.role::text as role,p.fonction_interne,p.actif,count(*)::integer as total
      from public.profiles p
      where p.pharmacie_id=any(v_ids)
      group by p.role,p.fonction_interne,p.actif
    ) x;

    v_promoteurs := v_promoteurs || jsonb_build_array(jsonb_build_object(
      'id',v_prom.id,
      'nom',v_prom.nom,
      'actif',v_prom.actif,
      'pharmacies_total',coalesce(cardinality(v_ids),0),
      'pharmacies',coalesce((
        select jsonb_agg(jsonb_build_object('id',ph.id,'nom',ph.nom) order by ph.nom,ph.id)
        from public.pharmacies ph where ph.id=any(v_ids)
      ),'[]'::jsonb),
      'comptes',v_comptes_promoteur,
      'indicateurs',v_prom_metrics
    ));
  end loop;

  v_sources := jsonb_build_object(
    'affectations_professionnelles',to_regclass('public.naxa_professional_assignments') is not null,
    'preparations_prescriptions',to_regclass('public.prescription_preparations') is not null,
    'audit_pharmacien',to_regclass('public.pharmacien_audit_events') is not null,
    'controles_comptables',to_regclass('public.compta_controles_cloture') is not null,
    'evenements_comptables',to_regclass('public.compta_evenement') is not null,
    'periodes_comptables',to_regclass('public.compta_periodes') is not null,
    'ecritures_comptables',to_regclass('public.compta_ecriture') is not null
  );

  v_totaux := v_totaux - '_pharmacies_total';
  v_totaux := v_totaux || jsonb_build_object(
    'pharmacies_total',v_total_pharmacies,
    'pharmacies_actives',v_pharmacies_actives,
    'pharmacies_inactives',v_total_pharmacies-v_pharmacies_actives,
    'clients_total',v_clients_total,
    'clients_actifs',v_clients_actifs,
    'promoteurs_total',v_promoteurs_total,
    'promoteurs_actifs',v_promoteurs_actifs,
    'comptes_professionnels',v_comptes_professionnels
  );

  return jsonb_build_object(
    'version',1,
    'periode',jsonb_build_object('jours',v_jours,'du',v_debut,'au',now()),
    'comptes_globaux',v_comptes,
    'totaux',v_totaux,
    'par_pharmacie',v_pharmacies,
    'par_promoteur',v_promoteurs,
    'sources',v_sources,
    'note_scope','Les chiffres réseau sont calculés une seule fois par pharmacie non démo. Les agrégats Promoteur suivent les rattachements actifs et peuvent se chevaucher si une pharmacie possède plusieurs rattachements Promoteur actifs. Les indicateurs de stock sont des états courants; les autres indicateurs sont bornés à la période sélectionnée.'
  );
end;
$$;

revoke all on function private.admin_pharmacy_account_metrics(uuid,integer) from public,anon,authenticated;
revoke all on function private.admin_comptes_indicateurs(integer) from public,anon,authenticated;

create or replace function public.admin_comptes_indicateurs(p_jours integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.admin_comptes_indicateurs($1)
$$;

revoke all on function public.admin_comptes_indicateurs(integer) from public,anon,authenticated;
grant execute on function public.admin_comptes_indicateurs(integer) to authenticated;

comment on function public.admin_comptes_indicateurs(integer) is
  'Indicateurs agrégés des comptes professionnels et clients, ventilés par pharmacie et Promoteur. Accès réservé à un Admin actif; les détails nominatifs et les données de santé ne sont jamais retournés.';
