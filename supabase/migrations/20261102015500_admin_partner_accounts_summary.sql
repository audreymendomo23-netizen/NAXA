-- NAXA — Étape 13 : inclure séparément les comptes Partenaires Marketplace.
-- Ce périmètre n'est pas rattaché à une pharmacie ni à un Promoteur.

create or replace function private.admin_partners_summary()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'totaux',jsonb_build_object(
      'partenaires_total',(select count(*)::integer from public.partners),
      'partenaires_actifs',(select count(*)::integer from public.partners where status='active'),
      'partenaires_en_attente',(select count(*)::integer from public.partners where status='pending'),
      'partenaires_suspendus',(select count(*)::integer from public.partners where status='suspended'),
      'membres_partenaires_total',(select count(*)::integer from public.partner_members),
      'membres_partenaires_uniques',(select count(distinct user_id)::integer from public.partner_members)
    ),
    'par_type_statut',coalesce((
      select jsonb_agg(jsonb_build_object(
        'type',x.partner_type,
        'statut',x.status,
        'total',x.total
      ) order by x.partner_type,x.status)
      from (
        select partner_type,status,count(*)::integer as total
        from public.partners
        group by partner_type,status
      ) x
    ),'[]'::jsonb)
  );
$$;

revoke all on function private.admin_partners_summary() from public,anon,authenticated;

create or replace function public.admin_comptes_indicateurs(p_jours integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_data jsonb;
begin
  -- Le moteur principal contrôle auth.uid(), role=admin et actif=true avant toute agrégation partenaire.
  v_data := private.admin_comptes_indicateurs(p_jours);
  return v_data || jsonb_build_object('partenaires_globaux',private.admin_partners_summary());
end;
$$;

revoke all on function public.admin_comptes_indicateurs(integer) from public,anon,authenticated;
grant execute on function public.admin_comptes_indicateurs(integer) to authenticated;

comment on function public.admin_comptes_indicateurs(integer) is
  'Indicateurs agrégés des comptes professionnels et clients par pharmacie et Promoteur, avec comptes Partenaires Marketplace séparés. Accès réservé à un Admin actif; aucune donnée client nominative ni donnée de santé n''est retournée.';
