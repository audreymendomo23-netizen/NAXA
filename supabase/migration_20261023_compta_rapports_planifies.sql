-- NAXA Comptable — rapport financier mensuel planifié.
-- Migration additive. À appliquer d'abord sur un environnement isolé.
begin;

create or replace function public.compta_generer_rapport_mensuel()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pharmacie record;
  v_debut date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_fin date := (date_trunc('month', current_date) - interval '1 day')::date;
  v_contenu jsonb;
  v_ventes bigint;
  v_total_ventes bigint;
  v_depenses bigint;
  v_mouvements bigint;
  v_ecritures bigint;
  v_count integer := 0;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and current_user <> 'postgres' then
    raise exception 'Génération des rapports réservée au service serveur';
  end if;

  for v_pharmacie in
    select p.id, p.nom from public.pharmacies p where p.actif = true
  loop
    if exists (
      select 1 from public.rapports r
      where r.portee = 'pharmacie'
        and r.scope_type = 'PHARMACIE'
        and r.scope_pharmacie_id = v_pharmacie.id
        and r.periode = 'mensuel'
        and r.du = v_debut and r.au = v_fin
        and coalesce(r.contenu, '{}'::jsonb) ? 'compta_naxa'
    ) then
      continue;
    end if;

    select count(*), coalesce(sum(v.total_net), 0)::bigint
      into v_ventes, v_total_ventes
    from public.ventes v
    where v.pharmacie_id = v_pharmacie.id
      and v.statut = 'payee'
      and v.paid_at >= v_debut::timestamp
      and v.paid_at < (v_fin + 1)::timestamp;

    select coalesce(sum(d.montant), 0)::bigint into v_depenses
    from public.depenses d
    where d.pharmacie_id = v_pharmacie.id
      and d.date_depense >= v_debut and d.date_depense <= v_fin;

    select coalesce(sum(m.montant), 0)::bigint into v_mouvements
    from public.tresorerie_mouvements m
    where m.pharmacie_id = v_pharmacie.id
      and m.date_operation >= v_debut::timestamp
      and m.date_operation < (v_fin + 1)::timestamp;

    select count(*) into v_ecritures
    from public.compta_ecriture e
    where e.pharmacie_id = v_pharmacie.id
      and e.date_ecriture >= v_debut and e.date_ecriture <= v_fin;

    v_contenu := jsonb_build_object(
      'compta_naxa', jsonb_build_object(
        'schema_version', 1,
        'periode_debut', v_debut,
        'periode_fin', v_fin,
        'ventes_payees_nombre', v_ventes,
        'ventes_payees_total_net_fcfa', v_total_ventes,
        'depenses_enregistrees_fcfa', v_depenses,
        'mouvements_tresorerie_bruts_fcfa', v_mouvements,
        'ecritures_comptables_nombre', v_ecritures,
        'limites', jsonb_build_array(
          'Totaux calculés depuis les enregistrements disponibles',
          'Dépenses incluses sans filtrage de statut',
          'Trésorerie brute, non égale à un solde net',
          'Aucune TVA recalculée ou supposée'
        )
      )
    );

    insert into public.rapports(
      portee, pharmacie_id, periode, du, au, contenu, texte,
      scope_type, scope_profile_id, scope_pharmacie_id
    ) values (
      'pharmacie', v_pharmacie.id, 'mensuel', v_debut, v_fin, v_contenu,
      format('NAXA Comptable — %s — %s au %s — ventes payées %s FCFA; dépenses %s FCFA; mouvements bruts %s FCFA. À contrôler par votre expert-comptable.',
        v_pharmacie.nom, v_debut, v_fin, v_total_ventes, v_depenses, v_mouvements),
      'PHARMACIE', null, v_pharmacie.id
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke all on function public.compta_generer_rapport_mensuel() from public, anon, authenticated;
grant execute on function public.compta_generer_rapport_mensuel() to service_role;

-- Le job mensuel ne s'installe que si pg_cron est disponible.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'naxa-compta-rapport-mensuel';
    perform cron.schedule(
      'naxa-compta-rapport-mensuel',
      '15 4 2 * *',
      $job$select public.compta_generer_rapport_mensuel();$job$
    );
  end if;
end;
$$;

commit;
