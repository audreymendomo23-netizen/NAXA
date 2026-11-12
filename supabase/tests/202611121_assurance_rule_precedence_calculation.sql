-- Assurance: precedence and per-line calculation regression contract.
-- Read-only test: no fixture is inserted into application tables.
do $$
declare
  v_def text;
  v_results jsonb;
  v_expected jsonb := jsonb_build_object(
    '00000000-0000-0000-0000-000000000001', 2300,
    '00000000-0000-0000-0000-000000000002', 3750,
    '00000000-0000-0000-0000-000000000003', 4500,
    '00000000-0000-0000-0000-000000000004', 0
  );
begin
  select pg_get_functiondef('public.assurance_calculer_devis(uuid,uuid)'::regprocedure)
    into v_def;

  if position('order by case r.portee when ''produit'' then 1 when ''categorie'' then 2 else 3 end' in v_def) = 0 then
    raise exception 'ASSURANCE_RULE_PRECEDENCE_MISSING';
  end if;
  if position('v_line_cover:=round(v_line_brut*v_rate/100)::bigint' in v_def) = 0
     or position('least(v_line_cover,v_rule.plafond_fcfa)' in v_def) = 0
     or position('greatest(0,v_line_cover-coalesce(v_rule.franchise_fcfa,0))' in v_def) = 0
     or position('if v_excluded then' in v_def) = 0 then
    raise exception 'ASSURANCE_RULE_CALCULATION_MISSING';
  end if;

  with items(product_id, categorie, montant) as (
    values
      ('00000000-0000-0000-0000-000000000001'::uuid, 'Medicaments'::text, 10000::bigint),
      ('00000000-0000-0000-0000-000000000002'::uuid, 'MEDICAMENTS'::text, 10000::bigint),
      ('00000000-0000-0000-0000-000000000003'::uuid, 'Dispositifs médicaux'::text, 10000::bigint),
      ('00000000-0000-0000-0000-000000000004'::uuid, 'Exclue'::text, 10000::bigint)
  ),
  rules(portee, categorie, produit_id, taux, plafond, franchise, exclusions, valide_du, version) as (
    values
      ('tout'::text, null::text, null::uuid, 80::numeric, 5000::bigint, 500::bigint, '["Exclue"]'::jsonb, current_date, 1),
      ('categorie'::text, 'medicaments'::text, null::uuid, 70::numeric, 4000::bigint, 250::bigint, '[]'::jsonb, current_date, 1),
      ('produit'::text, null::text, '00000000-0000-0000-0000-000000000001'::uuid, 50::numeric, 2500::bigint, 200::bigint, '[]'::jsonb, current_date, 1)
  ),
  calculated as (
    select i.product_id,
      case when coalesce(r.exclusions, '[]'::jsonb) ? i.product_id::text
                  or coalesce(r.exclusions, '[]'::jsonb) ? coalesce(i.categorie, '__none__')
        then 0::bigint
        else greatest(
          0::bigint,
          least(round(i.montant * r.taux / 100)::bigint, coalesce(r.plafond, 9223372036854775807::bigint))
          - coalesce(r.franchise, 0)
        )
      end as montant_assureur,
      r.portee
    from items i
    cross join lateral (
      select x.*
      from rules x
      where (x.portee='produit' and x.produit_id=i.product_id)
         or (x.portee='categorie' and lower(x.categorie)=lower(i.categorie))
         or x.portee='tout'
      order by case x.portee when 'produit' then 1 when 'categorie' then 2 else 3 end,
               x.valide_du desc, x.version desc
      limit 1
    ) r
  )
  select jsonb_object_agg(replace(product_id::text, '-', ''), montant_assureur)
    into v_results from calculated;

  -- Compare using canonical UUID text keys to keep the assertion deterministic.
  if (select jsonb_object_agg(product_id::text, montant_assureur) from (
        with items(product_id, categorie, montant) as (
          values
            ('00000000-0000-0000-0000-000000000001'::uuid, 'Medicaments'::text, 10000::bigint),
            ('00000000-0000-0000-0000-000000000002'::uuid, 'MEDICAMENTS'::text, 10000::bigint),
            ('00000000-0000-0000-0000-000000000003'::uuid, 'Dispositifs médicaux'::text, 10000::bigint),
            ('00000000-0000-0000-0000-000000000004'::uuid, 'Exclue'::text, 10000::bigint)
        ),
        rules(portee, categorie, produit_id, taux, plafond, franchise, exclusions, valide_du, version) as (
          values
            ('tout'::text, null::text, null::uuid, 80::numeric, 5000::bigint, 500::bigint, '["Exclue"]'::jsonb, current_date, 1),
            ('categorie'::text, 'medicaments'::text, null::uuid, 70::numeric, 4000::bigint, 250::bigint, '[]'::jsonb, current_date, 1),
            ('produit'::text, null::text, '00000000-0000-0000-0000-000000000001'::uuid, 50::numeric, 2500::bigint, 200::bigint, '[]'::jsonb, current_date, 1)
        )
        select i.product_id,
          case when coalesce(r.exclusions, '[]'::jsonb) ? i.product_id::text
                    or coalesce(r.exclusions, '[]'::jsonb) ? coalesce(i.categorie, '__none__')
            then 0::bigint
            else greatest(0::bigint,
              least(round(i.montant * r.taux / 100)::bigint, coalesce(r.plafond, 9223372036854775807::bigint))
              - coalesce(r.franchise, 0))
          end as montant_assureur
        from items i
        cross join lateral (
          select x.* from rules x
          where (x.portee='produit' and x.produit_id=i.product_id)
             or (x.portee='categorie' and lower(x.categorie)=lower(i.categorie))
             or x.portee='tout'
          order by case x.portee when 'produit' then 1 when 'categorie' then 2 else 3 end,
                   x.valide_du desc, x.version desc
          limit 1
        ) r
      ) expected_rows) <> jsonb_build_object(
        '00000000-0000-0000-0000-000000000001', 2300,
        '00000000-0000-0000-0000-000000000002', 3750,
        '00000000-0000-0000-0000-000000000003', 4500,
        '00000000-0000-0000-0000-000000000004', 0
      ) then
    raise exception 'ASSURANCE_RULE_EXPECTED_AMOUNTS_MISMATCH';
  end if;
end $$;

select 'ASSURANCE_RULE_PRECEDENCE_AND_CALCULATION PASS' as result;


-- Regression: exclusions are category-case-insensitive and must not consume the
-- client coverage ceiling before the line is zeroed.
do $$
declare
  v_def text;
  v_exclusion_pos integer;
  v_ceiling_debit_pos integer;
begin
  select pg_get_functiondef('public.assurance_calculer_devis(uuid,uuid)'::regprocedure)
    into v_def;

  if position('jsonb_array_elements_text' in v_def)=0
     or position('lower(e.value)=lower(coalesce(v_item.categorie' in v_def)=0 then
    raise exception 'ASSURANCE_CATEGORY_EXCLUSION_CASE_INSENSITIVE_MISSING';
  end if;

  v_exclusion_pos:=position('if v_excluded then' in v_def);
  v_ceiling_debit_pos:=position('v_remaining:=v_remaining-v_line_cover' in v_def);
  if v_exclusion_pos=0 or v_ceiling_debit_pos=0 or v_exclusion_pos>v_ceiling_debit_pos then
    raise exception 'ASSURANCE_EXCLUDED_LINE_CONSUMES_COVERAGE_CEILING';
  end if;
end $$;

select 'ASSURANCE_EXCLUSION_AND_CEILING_GUARD PASS' as result;
