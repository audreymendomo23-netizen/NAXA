-- NAXA 253 — séparer l'octroi de crédit de l'encaissement et de son remboursement.
-- Migration versionnée uniquement : appliquer et tester en base de test avant toute base active.
begin;

create or replace function public.compta_emettre_evenement_metier()
returns trigger
language plpgsql
security definer
set search_path=''
as $outbox$
declare
  v_type text;
  v_source text;
  v_date timestamptz;
  v_date_comptable date;
  v_montant bigint;
  v_ref text;
begin
  if tg_table_name='ventes' then
    if new.statut::text <> 'payee' or old.statut::text = 'payee'
       or coalesce(new.mode_paiement::text,'') = 'credit' then
      return new;
    end if;
    v_type := 'vente_encaissee';
    v_source := 'vente';
    v_date := coalesce(new.paid_at,new.created_at,clock_timestamp());
    v_date_comptable := (timezone('Africa/Douala',coalesce(new.paid_at,new.created_at,clock_timestamp())))::date;
    v_montant := new.total_net::bigint;
    v_ref := new.id::text;
  elsif tg_table_name='depenses' then
    if new.statut::text <> 'validee' or old.statut::text = 'validee' then
      return new;
    end if;
    v_type := 'depense_validee';
    v_source := 'depense';
    v_date := coalesce(new.validated_at,new.created_at,clock_timestamp());
    v_date_comptable := new.date_depense;
    v_montant := new.montant::bigint;
    v_ref := coalesce(nullif(trim(new.reference),''),new.id::text);
  else
    raise exception 'Source d''événement comptable non prise en charge';
  end if;

  -- Les montants nuls ne créent pas d'écriture comptable. Les sources restent intactes.
  if v_montant is null or v_montant <= 0 then
    return new;
  end if;

  insert into public.compta_evenement(
    pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,
    date_evenement,donnees
  )
  values(
    new.pharmacie_id,v_type,v_source,new.id::text,
    v_source || ':' || new.id::text || ':' || v_type,
    v_date,
    jsonb_build_object(
      'montant_fcfa',v_montant::text,
      'date_comptable',v_date_comptable::text,
      'reference_source',v_ref
    )
  )
  on conflict (pharmacie_id,cle_idempotence) do nothing;

  return new;
end;
$outbox$;

revoke all on function public.compta_emettre_evenement_metier() from public,anon,authenticated;

create or replace function public.compta_emettre_octroi_credit()
returns trigger
language plpgsql
security definer
set search_path=''
as $grant$
declare
  v_date timestamptz;
  v_date_comptable date;
begin
  if new.nature <> 'credit' then
    return new;
  end if;
  if new.montant is null or new.montant <= 0 then
    raise exception 'Montant octroi de crédit invalide pour la comptabilité';
  end if;

  v_date := coalesce(new.created_at,clock_timestamp());
  v_date_comptable := (timezone('Africa/Douala',v_date))::date;

  insert into public.compta_evenement(
    pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,
    date_evenement,donnees
  )
  values(
    new.pharmacie_id,'credit_octroi','credit_operation',new.id::text,
    'credit_operation:' || new.id::text || ':credit_octroi',
    v_date,
    jsonb_build_object(
      'montant_fcfa',new.montant::text,
      'date_comptable',v_date_comptable::text,
      'reference_source',coalesce(nullif(trim(new.reference),''),new.id::text)
    )
  )
  on conflict (pharmacie_id,cle_idempotence) do nothing;

  return new;
end;
$grant$;

revoke all on function public.compta_emettre_octroi_credit() from public,anon,authenticated;
drop trigger if exists compta_outbox_credit_octroi on public.client_credit_operations;
create trigger compta_outbox_credit_octroi
after insert on public.client_credit_operations
for each row
when (new.nature = 'credit')
execute function public.compta_emettre_octroi_credit();


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
  -- Un événement ne peut être finalisé qu'avec une période ouverte, des mappings
  -- exactement uniques et un journal explicitement validé pour cette pharmacie.
  begin
    if v_event.evenement_type not in ('vente_encaissee','depense_validee','credit_remboursement','credit_octroi')
       or v_event.source_type not in ('vente','depense','credit_operation') then
      raise exception 'type_evenement_non_pris_en_charge';
    end if;
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
