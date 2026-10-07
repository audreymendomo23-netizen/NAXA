-- NAXA 032 — Partie 5 : pilotage Promoteur par scope canonique
-- Canonicalisation : moteur interne privé + façade publique invoker.
-- Le RPC ne retourne les KPI qu'à un acteur possédant le privilège de pilotage
-- correspondant à son périmètre. Le scope Promoteur vient exclusivement de
-- promoteur_pharmacies actifs.

create or replace function private.stats_pilotage_scope(p_jours integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_role text;
  v_fonction text;
  v_pharmacies uuid[];
  v_jours integer := greatest(1,least(coalesce(p_jours,7),365));
  v_debut timestamptz := now()-make_interval(days=>v_jours);
  v_recherches bigint; v_sans_resultat bigint; v_fiches bigint; v_paniers bigint;
  v_reservations bigint; v_ventes bigint; v_ca bigint; v_retires bigint; v_clotures bigint;
  v_stock bigint; v_ruptures bigint; v_stock_age numeric;
begin
  if uid is null then raise exception 'Connexion requise'; end if;

  select p.role::text,p.fonction_interne
    into v_role,v_fonction
  from public.profiles p
  where p.id=uid and p.actif=true;

  if v_role is null then raise exception 'Accès refusé'; end if;

  -- Le périmètre de pilotage est aussi une autorisation : aucun rôle
  -- ne reçoit le dashboard uniquement parce qu'il est authentifié.
  if v_role='admin' then
    select coalesce(array_agg(ph.id),'{}'::uuid[]) into v_pharmacies
    from public.pharmacies ph
    where ph.est_demo is not true;
  elsif v_role='promoteur' then
    if not public.naxa_has_privilege('VIEW_NETWORK_PILOTAGE',null,'RESEAU') then
      raise exception 'Privilège Pilotage réseau requis';
    end if;
    select coalesce(array_agg(pp.pharmacie_id),'{}'::uuid[]) into v_pharmacies
    from public.promoteur_pharmacies pp
    join public.pharmacies ph on ph.id=pp.pharmacie_id
    where pp.promoteur_id=uid and pp.actif=true and ph.est_demo is not true;
  elsif v_role='pharmacie' and v_fonction='responsable' then
    if not public.naxa_has_privilege('VIEW_RESPONSABLE_PILOTAGE',
                                      (select pharmacie_id from public.profiles where id=uid),
                                      'PHARMACIE') then
      raise exception 'Privilège Pilotage Responsable requis';
    end if;
    select coalesce(array_agg(p.pharmacie_id),'{}'::uuid[]) into v_pharmacies
    from public.profiles p where p.id=uid and p.pharmacie_id is not null;
  elsif v_role='caisse' then
    if not public.naxa_has_privilege('VIEW_CAISSE_PILOTAGE',
                                      (select pharmacie_id from public.profiles where id=uid),
                                      'PHARMACIE') then
      raise exception 'Privilège Pilotage Caisse requis';
    end if;
    select coalesce(array_agg(p.pharmacie_id),'{}'::uuid[]) into v_pharmacies
    from public.profiles p where p.id=uid and p.pharmacie_id is not null;
  else
    raise exception 'Accès pilotage refusé';
  end if;

  select count(*) into v_recherches
  from public.evenements e
  where e.type='recherche' and e.created_at>=v_debut
    and ((v_role='admin' and (e.pharmacie_id is null or e.pharmacie_id=any(v_pharmacies)))
      or (v_role<>'admin' and e.pharmacie_id=any(v_pharmacies)));

  select count(*) into v_sans_resultat
  from public.evenements e
  where e.type='recherche' and e.resultats=0 and e.created_at>=v_debut
    and ((v_role='admin' and (e.pharmacie_id is null or e.pharmacie_id=any(v_pharmacies)))
      or (v_role<>'admin' and e.pharmacie_id=any(v_pharmacies)));

  select count(*) into v_fiches from public.evenements e
  where e.type='fiche_vue' and e.created_at>=v_debut and e.pharmacie_id=any(v_pharmacies);

  select count(*) into v_paniers from public.evenements e
  where e.type='panier_ajout' and e.created_at>=v_debut and e.pharmacie_id=any(v_pharmacies);

  select count(*) into v_reservations from public.reservations r
  where r.created_at>=v_debut and r.pharmacie_id=any(v_pharmacies);

  select coalesce(sum(v.ventes),0) into v_ventes
  from public.v_reservations_ca v
  where v.jour>=v_debut::date and v.pharmacie_id=any(v_pharmacies);

  select coalesce(sum(v.total),0) into v_ca
  from public.v_reservations_ca v
  where v.jour>=v_debut::date and v.pharmacie_id=any(v_pharmacies);

  select count(*) into v_retires from public.reservations r
  where r.created_at>=v_debut and r.pharmacie_id=any(v_pharmacies) and r.statut='retiree';

  select count(*) into v_clotures from public.reservations r
  where r.created_at>=v_debut and r.pharmacie_id=any(v_pharmacies)
    and r.statut in ('retiree','expiree','annulee');

  select count(*) into v_stock from public.stocks s
  where s.pharmacie_id=any(v_pharmacies) and s.quantite>0;

  select count(*) into v_ruptures from public.stocks s
  where s.pharmacie_id=any(v_pharmacies) and s.quantite=0;

  select coalesce(round(avg(extract(epoch from now()-ph.stock_updated_at)/3600)),0)
    into v_stock_age
  from public.pharmacies ph
  where ph.id=any(v_pharmacies) and ph.stock_updated_at is not null;

  return jsonb_build_object(
    'role',v_role,'fonction_interne',coalesce(v_fonction,''),'jours',v_jours,
    'pharmacies',jsonb_build_object(
      'total',coalesce(array_length(v_pharmacies,1),0),
      'actives',coalesce((select count(*) from public.pharmacies ph where ph.id=any(v_pharmacies) and ph.actif and ph.est_demo is not true),0),
      'inactives',coalesce((select count(*) from public.pharmacies ph where ph.id=any(v_pharmacies) and not ph.actif and ph.est_demo is not true),0)
    ),
    'recherches',jsonb_build_object('total',v_recherches,'sans_resultat',v_sans_resultat),
    'entonnoir',jsonb_build_object(
      'recherches',v_recherches,'fiches_vues',v_fiches,'paniers',v_paniers,
      'reservations',v_reservations,'ventes',v_ventes
    ),
    'ca',v_ca,
    'performance',jsonb_build_object(
      'taux_conversion_vente',case when v_reservations=0 then 0 else round(100.0*v_ventes/v_reservations,2) end,
      'taux_retrait',case when v_clotures=0 then 0 else round(100.0*v_retires/v_clotures,2) end,
      'panier_moyen',case when v_ventes=0 then 0 else round(v_ca::numeric/v_ventes,2) end,
      'taux_recherche_sans_resultat',case when v_recherches=0 then 0 else round(100.0*v_sans_resultat/v_recherches,2) end,
      'produits_en_stock',v_stock,'ruptures',v_ruptures,'stock_age_heures',v_stock_age
    ),
    'stock',jsonb_build_object('produits_en_stock',v_stock,'ruptures',v_ruptures),
    'alertes',coalesce((select count(*) from public.alertes a where a.pharmacie_id=any(v_pharmacies) and not a.lue),0),
    'serie',coalesce((
      select jsonb_agg(jsonb_build_object(
        'jour',g::date,
        'recherches',(select count(*) from public.evenements e where e.type='recherche' and e.created_at::date=g::date and ((v_role='admin' and (e.pharmacie_id is null or e.pharmacie_id=any(v_pharmacies))) or (v_role<>'admin' and e.pharmacie_id=any(v_pharmacies)))),
        'reservations',(select count(*) from public.reservations r where r.created_at::date=g::date and r.pharmacie_id=any(v_pharmacies)),
        'ventes',(select coalesce(sum(v.ventes),0) from public.v_reservations_ca v where v.jour=g::date and v.pharmacie_id=any(v_pharmacies))
      ) order by g)
      from generate_series(current_date-(least(v_jours,30)-1),current_date,interval '1 day') g
    ),'[]'::jsonb)
  );
end
$$;

revoke all on function private.stats_pilotage_scope(integer) from public,anon,authenticated;

create or replace function public.stats_pilotage_scope(p_jours integer default 7)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select private.stats_pilotage_scope($1)
$$;

revoke all on function public.stats_pilotage_scope(integer) from public,anon,authenticated;
grant execute on function public.stats_pilotage_scope(integer) to authenticated;
