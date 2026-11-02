
-- NAXA Comptable — contrepassation exacte d'une vente POS annulée.
-- Aucune écriture originale n'est modifiée; seule une nouvelle écriture inversée est créée.
begin;

create unique index if not exists compta_ecriture_contrepassation_unique_idx
  on public.compta_ecriture(contrepassation_de)
  where contrepassation_de is not null;

create or replace function public.compta_poster_contrepassation(
  p_pharmacie uuid,
  p_periode uuid,
  p_date date,
  p_journal text,
  p_ecriture_origine uuid,
  p_source_id text,
  p_cle_idempotence text,
  p_libelle text,
  p_acteur uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $contrepassation$
declare
  v_original public.compta_ecriture%rowtype;
  v_existing public.compta_ecriture%rowtype;
  v_count bigint;
  v_debit numeric;
  v_credit numeric;
  v_id uuid := gen_random_uuid();
  v_line record;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Contrepassation comptable réservée au service serveur'
      using errcode='42501';
  end if;

  if p_pharmacie is null or p_periode is null or p_date is null
     or p_journal is null or length(trim(p_journal)) not between 1 and 20
     or p_ecriture_origine is null or p_source_id is null
     or length(trim(p_source_id))=0 or p_cle_idempotence is null
     or length(trim(p_cle_idempotence))<8 or p_libelle is null
     or length(trim(p_libelle))<2 then
    raise exception 'Paramètres de contrepassation incomplets';
  end if;

  select e.* into v_existing
  from public.compta_ecriture e
  where e.pharmacie_id=p_pharmacie
    and e.cle_idempotence=trim(p_cle_idempotence);

  if found then
    if v_existing.contrepassation_de is distinct from p_ecriture_origine
       or v_existing.source_type <> 'vente_annulation'
       or v_existing.source_id <> trim(p_source_id)
       or v_existing.periode_id <> p_periode
       or v_existing.date_ecriture <> p_date
       or v_existing.journal_code <> trim(p_journal)
       or v_existing.libelle <> trim(p_libelle) then
      raise exception 'Clé d''idempotence de contrepassation déjà utilisée pour un contenu différent';
    end if;
    return v_existing.id;
  end if;

  select e.* into v_original
  from public.compta_ecriture e
  where e.id=p_ecriture_origine and e.pharmacie_id=p_pharmacie
  for update;

  if not found then
    raise exception 'Écriture originale introuvable dans cette pharmacie';
  end if;
  if v_original.contrepassation_de is not null then
    raise exception 'Une contrepassation ne peut pas être contrepassée';
  end if;
  if p_date < v_original.date_ecriture then
    raise exception 'Une contrepassation ne peut pas précéder l''écriture originale';
  end if;
  if exists(
    select 1 from public.compta_ecriture e
    where e.pharmacie_id=p_pharmacie and e.contrepassation_de=p_ecriture_origine
  ) then
    raise exception 'Cette écriture possède déjà une contrepassation';
  end if;
  if not exists(
    select 1 from public.compta_periodes p
    where p.id=p_periode and p.pharmacie_id=p_pharmacie
      and p.statut='ouverte' and p_date between p.date_debut and p.date_fin
  ) then
    raise exception 'Période de contrepassation absente, clôturée ou hors dates';
  end if;

  select count(*),coalesce(sum(l.debit_fcfa),0),coalesce(sum(l.credit_fcfa),0)
    into v_count,v_debit,v_credit
  from public.compta_ligne l
  where l.ecriture_id=p_ecriture_origine and l.pharmacie_id=p_pharmacie;

  if v_count<2 or v_debit<=0 or v_debit<>v_credit then
    raise exception 'Écriture originale absente ou déséquilibrée; contrepassation refusée';
  end if;

  insert into public.compta_ecriture(
    id,pharmacie_id,periode_id,journal_code,date_ecriture,
    source_type,source_id,cle_idempotence,libelle,contrepassation_de,cree_par
  ) values(
    v_id,p_pharmacie,p_periode,trim(p_journal),p_date,
    'vente_annulation',trim(p_source_id),trim(p_cle_idempotence),
    trim(p_libelle),p_ecriture_origine,p_acteur
  );

  for v_line in
    select l.compte_id,l.libelle,l.debit_fcfa,l.credit_fcfa
    from public.compta_ligne l
    where l.ecriture_id=p_ecriture_origine and l.pharmacie_id=p_pharmacie
    order by l.id
  loop
    insert into public.compta_ligne(
      ecriture_id,pharmacie_id,compte_id,libelle,debit_fcfa,credit_fcfa
    ) values(
      v_id,p_pharmacie,v_line.compte_id,
      left('Contrepassation — ' || v_line.libelle,240),
      v_line.credit_fcfa,v_line.debit_fcfa
    );
  end loop;

  perform public.compta_auditer(
    p_pharmacie,p_acteur,'ecriture_comptable_contrepassation',
    'ecriture',v_id::text,'succes',
    'contrepassation_de=' || p_ecriture_origine::text
  );

  return v_id;
end;
$contrepassation$;

revoke all on function public.compta_poster_contrepassation(uuid,uuid,date,text,uuid,text,text,text,uuid)
  from public,anon,authenticated;
grant execute on function public.compta_poster_contrepassation(uuid,uuid,date,text,uuid,text,text,text,uuid)
  to service_role;

comment on function public.compta_poster_contrepassation(uuid,uuid,date,text,uuid,text,text,text,uuid) is
  'Crée une contrepassation comptable immuable en inversant exactement les lignes de l''écriture originale; une seule contrepassation par écriture.';


create or replace function public.compta_emettre_evenement_metier()
returns trigger
language plpgsql
security definer
set search_path=''
as $outbox$
declare
  v_type text;
  v_source text;
  v_source_id text;
  v_date timestamptz;
  v_date_comptable date;
  v_montant bigint;
  v_ref text;
  v_vente_id uuid;
  v_demande_id uuid;
begin
  if tg_table_name='ventes' then
    if new.statut::text='annulee' and old.statut::text='payee' then
      select d.id into v_demande_id
      from public.vente_annulation_demandes d
      where d.vente_id=new.id and d.statut='approuvee'
      order by d.decidee_at desc nulls last,d.created_at desc
      limit 1;
      if v_demande_id is null then
        raise exception 'Annulation comptable impossible : approbation absente';
      end if;
      v_type := 'vente_annulee';
      v_source := 'vente_annulation';
      v_source_id := v_demande_id::text;
      v_date := clock_timestamp();
      v_date_comptable := timezone('Africa/Douala',v_date)::date;
      v_montant := new.total_net::bigint;
      v_ref := new.numero_vente;
      v_vente_id := new.id;
    elsif new.statut::text='payee' and old.statut::text<>'payee' then
      v_type := 'vente_encaissee';
      v_source := 'vente';
      v_source_id := new.id::text;
      v_date := coalesce(new.paid_at,new.created_at,clock_timestamp());
      v_date_comptable := timezone('Africa/Douala',v_date)::date;
      v_montant := new.total_net::bigint;
      v_ref := new.numero_vente;
      v_vente_id := new.id;
    else
      return new;
    end if;
  elsif tg_table_name='depenses' then
    if new.statut::text<>'validee' or old.statut::text='validee' then
      return new;
    end if;
    v_type := 'depense_validee';
    v_source := 'depense';
    v_source_id := new.id::text;
    v_date := coalesce(new.validated_at,new.created_at,clock_timestamp());
    v_date_comptable := new.date_depense;
    v_montant := new.montant::bigint;
    v_ref := coalesce(nullif(trim(new.reference),''),new.id::text);
  else
    raise exception 'Source d''événement comptable non prise en charge';
  end if;

  if v_montant is null or v_montant<=0 then
    return new;
  end if;

  insert into public.compta_evenement(
    pharmacie_id,evenement_type,source_type,source_id,cle_idempotence,
    date_evenement,donnees
  )
  values(
    new.pharmacie_id,v_type,v_source,v_source_id,
    v_source || ':' || v_source_id || ':' || v_type,
    v_date,
    jsonb_build_object(
      'montant_fcfa',v_montant::text,
      'date_comptable',v_date_comptable::text,
      'reference_source',v_ref
    ) || case when v_type='vente_annulee'
      then jsonb_build_object('vente_id',v_vente_id,'annulation_demande_id',v_demande_id)
      else '{}'::jsonb end
  )
  on conflict (pharmacie_id,cle_idempotence) do nothing;

  return new;
end;
$outbox$;

revoke all on function public.compta_emettre_evenement_metier() from public,anon,authenticated;


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
  v_original_entry uuid;
  v_vente_id uuid;
  v_count bigint;
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
    if v_event.evenement_type not in ('vente_encaissee','depense_validee','vente_annulee')
       or v_event.source_type not in ('vente','depense','vente_annulation') then
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

    if v_event.evenement_type='vente_annulee' then
      if v_event.source_type<>'vente_annulation' then
        raise exception 'source_annulation_invalide';
      end if;
      v_vente_id := nullif(v_event.donnees->>'vente_id','')::uuid;
      if v_vente_id is null then raise exception 'vente_origine_absente'; end if;

      select count(*),(array_agg(e.id order by e.id))[1] into v_count,v_original_entry
      from public.compta_ecriture e
      where e.pharmacie_id=v_event.pharmacie_id
        and e.source_type='vente'
        and e.source_id=v_vente_id::text
        and e.contrepassation_de is null;
      if v_count<>1 then
        raise exception 'ecriture_vente_origine_absente_ou_ambigue';
      end if;

      if (select count(*) from public.compta_parametre p
          where p.pharmacie_id=v_event.pharmacie_id
            and p.cle='journal_code.vente_annulee'
            and p.statut='valide'
            and p.valide_du<=v_date
            and (p.valide_jusquau is null or p.valide_jusquau>=v_date)) <> 1 then
        raise exception 'journal_contrepassation_absent_ou_ambigu';
      end if;
      select * into v_param
      from public.compta_parametre p
      where p.pharmacie_id=v_event.pharmacie_id
        and p.cle='journal_code.vente_annulee'
        and p.statut='valide'
        and p.valide_du<=v_date
        and (p.valide_jusquau is null or p.valide_jusquau>=v_date);
      if jsonb_typeof(v_param.valeur)<>'string'
         or length(trim(v_param.valeur #>> '{}')) not between 1 and 20 then
        raise exception 'journal_contrepassation_non_configure';
      end if;

      v_ecriture := public.compta_poster_contrepassation(
        v_event.pharmacie_id,v_periode,v_date,trim(v_param.valeur #>> '{}'),
        v_original_entry,v_event.source_id,v_event.cle_idempotence,
        'Contrepassation de la vente ' || v_vente_id::text,null
      );
      perform public.compta_evenement_terminer(p_evenement,p_claim_token,true,null);
      return 'traite';
    end if;

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


commit;
