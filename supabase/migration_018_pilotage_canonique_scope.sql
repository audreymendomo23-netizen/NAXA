-- NAXA 018 — Pilotage canonique par scope
-- Additif, non destructif. Aucun KPI parallèle : cette RPC centralise le pilotage NAXA.
create or replace function public.stats_pilotage_scope(p_jours integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_role text;
  v_pharmacies uuid[];
  v_jours integer := greatest(1, least(coalesce(p_jours,7),365));
  v_debut timestamptz := now() - make_interval(days => v_jours);
begin
  if uid is null then raise exception 'Connexion requise'; end if;

  select role::text into v_role
  from public.profiles
  where id=uid and actif=true;

  if v_role is null then raise exception 'Accès refusé'; end if;

  if v_role='admin' then
    select coalesce(array_agg(ph.id), '{}'::uuid[]) into v_pharmacies
    from public.pharmacies ph
    where ph.est_demo is not true;
  elsif v_role='promoteur' then
    select coalesce(array_agg(x), '{}'::uuid[]) into v_pharmacies
    from public.my_pharmacies() x
    where exists (select 1 from public.pharmacies ph where ph.id=x and ph.est_demo is not true);
  elsif v_role in ('responsable','caisse','pharmacie') then
    select coalesce(array_agg(pharmacie_id), '{}'::uuid[]) into v_pharmacies
    from public.profiles
    where id=uid and pharmacie_id is not null;
  else
    raise exception 'Accès pilotage refusé';
  end if;

  return jsonb_build_object(
    'role', v_role,
    'jours', v_jours,
    'pharmacies', jsonb_build_object(
      'total', coalesce((select count(*) from unnest(v_pharmacies)),0),
      'actives', coalesce((select count(*) from unnest(v_pharmacies) x join public.pharmacies ph on ph.id=x where ph.actif and ph.est_demo is not true),0),
      'inactives', coalesce((select count(*) from unnest(v_pharmacies) x join public.pharmacies ph on ph.id=x where not ph.actif and ph.est_demo is not true),0)
    ),
    'recherches', jsonb_build_object(
      'total', coalesce((select count(*) from public.evenements e where e.type='recherche' and e.created_at>=v_debut and (e.pharmacie_id is null or e.pharmacie_id=any(v_pharmacies))),0),
      'sans_resultat', coalesce((select count(*) from public.evenements e where e.type='recherche' and e.resultats=0 and e.created_at>=v_debut and (e.pharmacie_id is null or e.pharmacie_id=any(v_pharmacies))),0)
    ),
    'entonnoir', jsonb_build_object(
      'recherches', coalesce((select count(*) from public.evenements e where e.type='recherche' and e.created_at>=v_debut and (e.pharmacie_id is null or e.pharmacie_id=any(v_pharmacies))),0),
      'fiches_vues', coalesce((select count(*) from public.evenements e where e.type='fiche_vue' and e.created_at>=v_debut and e.pharmacie_id=any(v_pharmacies)),0),
      'paniers', coalesce((select count(*) from public.evenements e where e.type='panier_ajout' and e.created_at>=v_debut and e.pharmacie_id=any(v_pharmacies)),0),
      'reservations', coalesce((select count(*) from public.reservations r where r.created_at>=v_debut and r.pharmacie_id=any(v_pharmacies)),0),
      'ventes', coalesce((select count(*) from public.v_reservations_ca v where v.jour>=v_debut::date and v.pharmacie_id=any(v_pharmacies)),0)
    ),
    'ca', coalesce((select sum(v.total)::int from public.v_reservations_ca v where v.jour>=v_debut::date and v.pharmacie_id=any(v_pharmacies)),0),
    'stock', jsonb_build_object(
      'produits_en_stock', coalesce((select count(*) from public.stocks s where s.pharmacie_id=any(v_pharmacies) and s.quantite>0),0),
      'ruptures', coalesce((select count(*) from public.stocks s where s.pharmacie_id=any(v_pharmacies) and s.quantite=0),0)
    ),
    'alertes', coalesce((select count(*) from public.alertes a where a.pharmacie_id=any(v_pharmacies) and not a.lue),0),
    'serie', coalesce((
      select jsonb_agg(jsonb_build_object(
        'jour',g::date,
        'recherches',(select count(*) from public.evenements e where e.type='recherche' and e.created_at::date=g::date and (e.pharmacie_id is null or e.pharmacie_id=any(v_pharmacies))),
        'reservations',(select count(*) from public.reservations r where r.created_at::date=g::date and r.pharmacie_id=any(v_pharmacies)),
        'ventes',(select count(*) from public.v_reservations_ca v where v.jour=g::date and v.pharmacie_id=any(v_pharmacies))
      ) order by g)
      from generate_series(current_date-(least(v_jours,30)-1),current_date,interval '1 day') g
    ), '[]'::jsonb)
  );
end
$$;

revoke execute on function public.stats_pilotage_scope(integer) from public,anon,authenticated;
grant execute on function public.stats_pilotage_scope(integer) to authenticated;
