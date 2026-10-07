-- NAXA — Pilotage 360° Partie 4 : Direction 360°
-- Socle exécutif consolidé, strictement dérivé des sources canoniques déjà validées.
begin;

insert into public.naxa_privileges(
  code,domaine,family,description,niveau_min,niveau_max,delegable,governance,active
)
values(
  'VIEW_DIRECTION_360',
  'pilotage','pilotage',
  'Accès au cockpit Direction 360° NAXA consolidant réseau, commercial, performance et sécurité',
  0,0,false,true,true
)
on conflict(code) do update set
  family=excluded.family,
  description=excluded.description,
  niveau_min=excluded.niveau_min,
  niveau_max=excluded.niveau_max,
  delegable=excluded.delegable,
  governance=excluded.governance,
  active=true;

create or replace function public.stats_direction_360(p_jours integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $body$
declare
  uid uuid := (select auth.uid());
  role_name text;
  from_ts timestamptz;
  v_pharmacies bigint:=0;
  v_pharmacies_actives bigint:=0;
  v_pharmacies_inactives bigint:=0;
  v_promoteurs bigint:=0;
  v_responsables bigint:=0;
  v_caisses bigint:=0;
  v_clients bigint:=0;
  v_ca bigint:=0;
  v_ventes bigint:=0;
  v_reservations bigint:=0;
  v_payees bigint:=0;
  v_retirees bigint:=0;
  v_stock_lines bigint:=0;
  v_stock_units bigint:=0;
  v_out_of_stock bigint:=0;
  v_stock_coverage numeric:=0;
  v_sessions bigint:=0;
  v_session_created bigint:=0;
  v_session_ended bigint:=0;
  v_conventions_expirees bigint:=0;
  v_abonnements_expires bigint:=0;
begin
  if uid is null then raise exception 'Connexion requise'; end if;
  if p_jours<1 or p_jours>366 then raise exception 'Période invalide'; end if;

  select public.naxa_business_function(uid) into role_name;
  if role_name <> 'admin' then
    raise exception 'DIRECTION_360_ADMIN_ONLY';
  end if;

  from_ts:=now()-make_interval(days=>p_jours);

  select count(*), count(*) filter(where actif), count(*) filter(where not actif)
    into v_pharmacies,v_pharmacies_actives,v_pharmacies_inactives
  from public.pharmacies;

  select count(*) filter(where role::text='promoteur'),
         count(*) filter(where fonction_interne='responsable'),
         count(*) filter(where role::text='caisse'),
         count(*) filter(where role::text='client')
    into v_promoteurs,v_responsables,v_caisses,v_clients
  from public.profiles
  where actif;

  select coalesce(sum(ca_xaf),0),count(*)
    into v_ca,v_ventes
  from public.v_reservations_ca
  where created_at>=from_ts;

  select count(*),
         count(*) filter(where statut='payee'),
         count(*) filter(where statut='retiree')
    into v_reservations,v_payees,v_retirees
  from public.reservations
  where created_at>=from_ts;

  select count(*),coalesce(sum(quantite),0),count(*) filter(where quantite=0)
    into v_stock_lines,v_stock_units,v_out_of_stock
  from public.stocks;

  if v_stock_lines>0 then
    v_stock_coverage:=round(((v_stock_lines-v_out_of_stock)::numeric/v_stock_lines::numeric)*100,2);
  end if;

  select count(*) into v_sessions from auth.sessions;

  if to_regclass('public.session_audit') is not null then
    select count(*) filter(where event='created'),
           count(*) filter(where event='ended')
      into v_session_created,v_session_ended
    from public.session_audit
    where occurred_at>=from_ts;
  end if;

  if to_regclass('public.conventions_promoteurs') is not null then
    select count(*) into v_conventions_expirees
    from public.conventions_promoteurs
    where date_expiration is not null and date_expiration<current_date;
  end if;

  if to_regclass('public.abonnements_promoteurs') is not null then
    select count(*) into v_abonnements_expires
    from public.abonnements_promoteurs
    where echeance is not null and echeance<current_date;
  end if;

  return jsonb_build_object(
    'role','admin',
    'jours',p_jours,
    'scope','RESEAU_NAXA',
    'network',jsonb_build_object(
      'pharmacies_total',v_pharmacies,
      'pharmacies_actives',v_pharmacies_actives,
      'pharmacies_inactives',v_pharmacies_inactives,
      'promoteurs_actifs',v_promoteurs,
      'responsables_actifs',v_responsables,
      'caisses_actives',v_caisses,
      'clients_actifs',v_clients
    ),
    'commercial',jsonb_build_object(
      'ca_xaf',v_ca,
      'ventes',v_ventes,
      'panier_moyen_xaf',case when v_ventes>0 then round(v_ca::numeric/v_ventes::numeric,2) else 0 end,
      'reservations',v_reservations,
      'payees',v_payees,
      'retirees',v_retirees
    ),
    'performance',jsonb_build_object(
      'lignes_stock',v_stock_lines,
      'unites_stock',v_stock_units,
      'ruptures_lignes',v_out_of_stock,
      'couverture_stock_pct',v_stock_coverage
    ),
    'security',jsonb_build_object(
      'sessions_actives',v_sessions,
      'sessions_creees_periode',v_session_created,
      'sessions_terminees_periode',v_session_ended,
      'conventions_expirees',v_conventions_expirees,
      'abonnements_expirees',v_abonnements_expires
    ),
    'unsupported_until_erp',jsonb_build_array(
      'marge','benefice','couts','performance_par_caisse','retention_client'
    )
  );
end;
$body$;

revoke all on function public.stats_direction_360(integer) from public,anon;
grant execute on function public.stats_direction_360(integer) to authenticated;

commit;
