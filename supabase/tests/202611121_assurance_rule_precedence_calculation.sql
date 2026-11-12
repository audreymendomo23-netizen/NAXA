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
      ('tout'::text, null::text, null::uuid, 80::numeric, 5000::bigint, 500::bigint, '["EXCLUE"]'::jsonb, current_date, 1),
      ('categorie'::text, 'medicaments'::text, null::uuid, 70::numeric, 4000::bigint, 250::bigint, '[]'::jsonb, current_date, 1),
      ('produit'::text, null::text, '00000000-0000-0000-0000-000000000001'::uuid, 50::numeric, 2500::bigint, 200::bigint, '[]'::jsonb, current_date, 1)
  ),
  calculated as (
    select i.product_id,
      case when coalesce(r.exclusions, '[]'::jsonb) ? i.product_id::text
                  or exists (select 1 from jsonb_array_elements_text(coalesce(r.exclusions, '[]'::jsonb)) e(value) where lower(e.value)=lower(coalesce(i.categorie, '__none__')))
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
            ('tout'::text, null::text, null::uuid, 80::numeric, 5000::bigint, 500::bigint, '["EXCLUE"]'::jsonb, current_date, 1),
            ('categorie'::text, 'medicaments'::text, null::uuid, 70::numeric, 4000::bigint, 250::bigint, '[]'::jsonb, current_date, 1),
            ('produit'::text, null::text, '00000000-0000-0000-0000-000000000001'::uuid, 50::numeric, 2500::bigint, 200::bigint, '[]'::jsonb, current_date, 1)
        )
        select i.product_id,
          case when coalesce(r.exclusions, '[]'::jsonb) ? i.product_id::text
                    or exists (select 1 from jsonb_array_elements_text(coalesce(r.exclusions, '[]'::jsonb)) e(value) where lower(e.value)=lower(coalesce(i.categorie, '__none__')))
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

-- Excluded line must not reduce the remaining global coverage ceiling.
do $$
declare v_amounts bigint[];
begin
  with lines(ord, proposed, excluded) as (
    values (1,2300::bigint,false),(2,3750::bigint,false),(3,4500::bigint,false),
           (4,4500::bigint,true),(5,4500::bigint,false)
  ),
  calc as (
    select ord,
      case when excluded then 0::bigint
        else least(proposed,greatest(0::bigint,
          15000::bigint-coalesce(sum(case when not excluded then proposed else 0 end)
            over(order by ord rows between unbounded preceding and 1 preceding),0)))
      end as covered
    from lines
  )
  select array_agg(covered order by ord) into v_amounts from calc;
  if v_amounts <> array[2300,3750,4500,0,4450]::bigint[] then
    raise exception 'ASSURANCE_EXCLUSION_CEILING_EXPECTED %, GOT %',
      array[2300,3750,4500,0,4450]::bigint[],v_amounts;
  end if;
end $$;

select 'ASSURANCE_EXCLUSION_DOES_NOT_CONSUME_CEILING PASS' as result;


-- Accounting boundary: a quote is not a receivable; only pharmacy confirmation
-- creates the insurer receivable, and only an actual reimbursement creates cash receipt.
do $$
declare v_calc text; v_confirm text; v_reimburse text;
begin
  select pg_get_functiondef('public.assurance_calculer_devis(uuid,uuid)'::regprocedure) into v_calc;
  select pg_get_functiondef('public.assurance_confirmer_prise_en_charge(uuid,text)'::regprocedure) into v_confirm;
  select pg_get_functiondef('public.assurance_enregistrer_remboursement(uuid,bigint,date,text,text)'::regprocedure) into v_reimburse;

  if position('insert into public.compta_evenement' in v_calc)>0 then
    raise exception 'QUOTE_MUST_NOT_CREATE_ACCOUNTING_ENTRY';
  end if;
  if position('insert into public.compta_evenement' in v_confirm)=0
     or position('assurance_prise_en_charge' in v_confirm)=0
     or position('on conflict (cle_idempotence) do nothing' in v_confirm)=0 then
    raise exception 'ACCEPTED_CLAIM_RECEIVABLE_EVENT_MISSING_OR_NOT_IDEMPOTENT';
  end if;
  if position('insert into public.compta_evenement' in v_reimburse)=0
     or position('assurance_remboursement_recu' in v_reimburse)=0 then
    raise exception 'ACTUAL_REIMBURSEMENT_CASH_EVENT_MISSING';
  end if;
end $$;

select 'ASSURANCE_ACCOUNTING_EVENT_BOUNDARIES PASS' as result;
