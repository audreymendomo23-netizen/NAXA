-- NAXA Comptable — worker de comptabilisation, étape 3.
-- À appliquer après migration_20261021_compta_outbox.sql. Aucun compte/taux/journal par défaut.
begin;

create or replace function public.compta_traiter_evenement(
  p_evenement uuid,
  p_claim_token uuid
)
returns text
language plpgsql
security definer
set search_path=''
as $worker$
declare
  v_event public.compta_evenement%rowtype;
  v_date date;
  v_montant bigint;
  v_periode uuid;
  v_debit uuid;
  v_credit uuid;
  v_journal text;
  v_param public.compta_parametre%rowtype;
  v_ecriture uuid;
  v_lignes jsonb;
  v_sqlstate text;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Worker comptable réservé au service role';
  end if;
  if p_evenement is null or p_claim_token is null then
    raise exception 'Réclamation incomplète';
  end if;

  select * into v_event
  from public.compta_evenement
  where id=p_evenement and statut='en_cours' and claim_token=p_claim_token
  for update;
  if not found then
    raise exception 'Événement non réclamé ou jeton expiré';
  end if;
  if v_event.evenement_type not in ('vente_encaissee','depense_validee')
     or v_event.source_type not in ('vente','depense') then
    raise exception 'type_evenement_non_pris_en_charge';
  end if;

  -- Un événement ne peut être finalisé qu'avec une période ouverte, des mappings
  -- exactement uniques et un journal explicitement validé pour cette pharmacie.
  begin
    v_date := (v_event.donnees->>'date_comptable')::date;
    v_montant := (v_event.donnees->>'montant_fcfa')::bigint;
    if v_date is null or v_montant is null or v_montant <= 0 then
      raise exception 'donnees_evenement_invalides';
    end if;
    if v_event.donnees->>'date_comptable' !~ '^\d{4}-\d{2}-\d{2}$'
       or to_char(v_date,'YYYY-MM-DD') <> v_event.donnees->>'date_comptable' then
      raise exception 'date_comptable_invalide';
    end if;

    if (select count(*) from public.compta_periodes p
        where p.pharmacie_id=v_event.pharmacie_id
          and p.statut='ouverte'
          and v_date between p.date_debut and p.date_fin) <> 1 then
      raise exception 'periode_absente_ou_ambigue';
    end if;
    select p.id into v_periode
    from public.compta_periodes p
    where p.pharmacie_id=v_event.pharmacie_id
      and p.statut='ouverte'
      and v_date between p.date_debut and p.date_fin;

    if (select count(*) from public.compta_mapping_compte m
        join public.compta_plan_comptable c
          on c.id=m.compte_id and c.pharmacie_id=m.pharmacie_id and c.statut='valide'
        where m.pharmacie_id=v_event.pharmacie_id
          and m.evenement_type=v_event.evenement_type and m.sens='debit'
          and m.statut='valide'
          and (m.valide_du is null or m.valide_du<=v_date)
          and (m.valide_jusquau is null or m.valide_jusquau>=v_date)) <> 1 then
      raise exception 'mapping_debit_absent_ou_ambigu';
    end if;
    if (select count(*) from public.compta_mapping_compte m
        join public.compta_plan_comptable c
          on c.id=m.compte_id and c.pharmacie_id=m.pharmacie_id and c.statut='valide'
        where m.pharmacie_id=v_event.pharmacie_id
          and m.evenement_type=v_event.evenement_type and m.sens='credit'
          and m.statut='valide'
          and (m.valide_du is null or m.valide_du<=v_date)
          and (m.valide_jusquau is null or m.valide_jusquau>=v_date)) <> 1 then
      raise exception 'mapping_credit_absent_ou_ambigu';
    end if;

    select m.compte_id into v_debit
    from public.compta_mapping_compte m
    join public.compta_plan_comptable c
      on c.id=m.compte_id and c.pharmacie_id=m.pharmacie_id and c.statut='valide'
    where m.pharmacie_id=v_event.pharmacie_id
      and m.evenement_type=v_event.evenement_type and m.sens='debit'
      and m.statut='valide'
      and (m.valide_du is null or m.valide_du<=v_date)
      and (m.valide_jusquau is null or m.valide_jusquau>=v_date);
    select m.compte_id into v_credit
    from public.compta_mapping_compte m
    join public.compta_plan_comptable c
      on c.id=m.compte_id and c.pharmacie_id=m.pharmacie_id and c.statut='valide'
    where m.pharmacie_id=v_event.pharmacie_id
      and m.evenement_type=v_event.evenement_type and m.sens='credit'
      and m.statut='valide'
      and (m.valide_du is null or m.valide_du<=v_date)
      and (m.valide_jusquau is null or m.valide_jusquau>=v_date);

    if (select count(*) from public.compta_parametre p
        where p.pharmacie_id=v_event.pharmacie_id
          and p.cle='journal_code.' || v_event.evenement_type
          and p.statut='valide'
          and p.valide_du<=v_date
          and (p.valide_jusquau is null or p.valide_jusquau>=v_date)) <> 1 then
      raise exception 'journal_comptable_absent_ou_ambigu';
    end if;
    select * into v_param
    from public.compta_parametre p
    where p.pharmacie_id=v_event.pharmacie_id
      and p.cle='journal_code.' || v_event.evenement_type
      and p.statut='valide'
      and p.valide_du<=v_date
      and (p.valide_jusquau is null or p.valide_jusquau>=v_date);
    if jsonb_typeof(v_param.valeur) <> 'string'
       or length(trim(v_param.valeur #>> '{}')) not between 1 and 20 then
      raise exception 'journal_comptable_non_configure';
    end if;
    v_journal := trim(v_param.valeur #>> '{}');

    v_lignes := jsonb_build_array(
      jsonb_build_object('compte_id',v_debit,'libelle','Événement ' || v_event.evenement_type,
        'debit_fcfa',v_montant,'credit_fcfa',0),
      jsonb_build_object('compte_id',v_credit,'libelle','Événement ' || v_event.evenement_type,
        'debit_fcfa',0,'credit_fcfa',v_montant)
    );

    v_ecriture := public.compta_poster_ecriture(
      v_event.pharmacie_id,v_periode,v_date,v_journal,
      v_event.source_type,v_event.source_id,v_event.cle_idempotence,
      'Événement ' || v_event.evenement_type || ' ' || coalesce(v_event.donnees->>'reference_source',v_event.source_id),
      v_lignes,null
    );

    perform public.compta_evenement_terminer(p_evenement,p_claim_token,true,null);
    return 'traite';
  exception when others then
    get stacked diagnostics v_sqlstate = returned_sqlstate;
    -- Les erreurs métier sont stockées comme codes techniques, jamais comme messages
    -- SQL bruts susceptibles de contenir des données ou des références sensibles.
    update public.compta_evenement e
    set statut=case when e.tentatives>=8 then 'erreur' else 'a_traiter' end,
        prochaine_tentative=case when e.tentatives>=8 then null else now()+interval '15 minutes' end,
        traite_le=null,
        code_erreur='worker_' || left(regexp_replace(v_sqlstate,'[^A-Za-z0-9_]','_','g'),16),
        claim_token=null,
        verrouille_jusqua=null
    where e.id=p_evenement and e.claim_token=p_claim_token and e.statut='en_cours';
    return case when exists(select 1 from public.compta_evenement e where e.id=p_evenement and e.statut='erreur')
      then 'erreur' else 'a_traiter' end;
  end;
end;
$worker$;

revoke all on function public.compta_traiter_evenement(uuid,uuid) from public,anon,authenticated;
grant execute on function public.compta_traiter_evenement(uuid,uuid) to service_role;

commit;
