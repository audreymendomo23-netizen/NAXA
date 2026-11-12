-- NAXA — événements comptables réellement pris en charge et validations sérialisées.
begin;
create or replace function public.compta_plan_enregistrer_mapping(
  p_pharmacie uuid,p_id uuid,p_evenement_type text,p_sens text,p_compte uuid,p_valide_du date,p_valide_jusquau date
) returns uuid language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_id uuid;
begin
  if v_uid is null or not public.compta_ecriture_autorisee(p_pharmacie) then
    raise exception 'Droit de configuration comptable requis' using errcode='42501';
  end if;
  if trim(coalesce(p_evenement_type,'')) not in ('vente_encaissee','depense_validee','assurance_prise_en_charge','assurance_remboursement_recu')
    or p_sens not in ('debit','credit')
    or (p_valide_du is not null and p_valide_jusquau is not null and p_valide_jusquau<p_valide_du)
    or not exists(select 1 from public.compta_plan_comptable c where c.id=p_compte
      and c.pharmacie_id=p_pharmacie and c.statut='valide') then
    raise exception 'Mapping invalide : événement pris en charge, sens, période ou compte non validé';
  end if;
  if p_id is null then
    insert into public.compta_mapping_compte(pharmacie_id,evenement_type,sens,compte_id,statut,valide_du,valide_jusquau)
    values(p_pharmacie,trim(p_evenement_type),p_sens,p_compte,'a_valider',p_valide_du,p_valide_jusquau)
    returning id into v_id;
  else
    update public.compta_mapping_compte set evenement_type=trim(p_evenement_type),sens=p_sens,
      compte_id=p_compte,valide_du=p_valide_du,valide_jusquau=p_valide_jusquau
    where id=p_id and pharmacie_id=p_pharmacie and statut='a_valider' returning id into v_id;
    if v_id is null then raise exception 'Mapping absent ou déjà validé : modification interdite'; end if;
  end if;
  perform public.compta_auditer(p_pharmacie,v_uid,'mapping_compte_enregistre','mapping',v_id::text,
    'succes','Mapping en attente de validation');
  return v_id;
end $$;

create or replace function public.compta_plan_valider_mapping(p_pharmacie uuid,p_mapping uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_event text; v_sens text; v_debut date; v_fin date; v_compte uuid;
begin
  if v_uid is null or not public.compta_ecriture_autorisee(p_pharmacie) then
    raise exception 'Droit de validation comptable requis' using errcode='42501';
  end if;
  select evenement_type,sens,valide_du,valide_jusquau,compte_id
    into v_event,v_sens,v_debut,v_fin,v_compte
  from public.compta_mapping_compte where id=p_mapping and pharmacie_id=p_pharmacie
    and statut='a_valider' for update;
  if not found or v_compte is null or not exists(select 1 from public.compta_plan_comptable
    where id=v_compte and pharmacie_id=p_pharmacie and statut='valide') then
    raise exception 'Mapping absent ou compte non validé';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_pharmacie::text || ':' || v_event || ':' || v_sens,0));
  if exists(select 1 from public.compta_mapping_compte m
    where m.pharmacie_id=p_pharmacie and m.id<>p_mapping and m.evenement_type=v_event
      and m.sens=v_sens and m.statut='valide'
      and daterange(coalesce(m.valide_du,'-infinity'::date),coalesce(m.valide_jusquau,'infinity'::date),'[]')
        && daterange(coalesce(v_debut,'-infinity'::date),coalesce(v_fin,'infinity'::date),'[]')) then
    raise exception 'Un mapping validé chevauche déjà cette période pour cet événement et ce sens';
  end if;
  update public.compta_mapping_compte set statut='valide',valide_par=v_uid,valide_le=now()
  where id=p_mapping and pharmacie_id=p_pharmacie;
  perform public.compta_auditer(p_pharmacie,v_uid,'mapping_compte_valide','mapping',p_mapping::text,
    'succes','Validation du mapping');
  return true;
end $$;

create or replace function public.compta_config_valider_journal(p_pharmacie uuid,p_parametre uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_uid uuid:=auth.uid(); v_row public.compta_parametre%rowtype;
begin
  if v_uid is null or not public.compta_ecriture_autorisee(p_pharmacie) then
    raise exception 'Droit de validation comptable requis' using errcode='42501';
  end if;
  select * into v_row from public.compta_parametre where id=p_parametre
    and pharmacie_id=p_pharmacie and cle like 'journal_code.%' and statut='a_valider' for update;
  if not found then raise exception 'Journal absent ou déjà validé'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    p_pharmacie::text || ':' || v_row.cle,0));
  if v_row.valide_du is null or jsonb_typeof(v_row.valeur)<>'string'
    or length(trim(v_row.valeur #>> '{}')) not between 1 and 20 then
    raise exception 'Journal incomplet : code et date de début obligatoires';
  end if;
  if exists(select 1 from public.compta_parametre p where p.pharmacie_id=p_pharmacie
    and p.cle=v_row.cle and p.id<>v_row.id and p.statut='valide'
    and daterange(p.valide_du,coalesce(p.valide_jusquau,'infinity'::date),'[]')
      && daterange(v_row.valide_du,coalesce(v_row.valide_jusquau,'infinity'::date),'[]')) then
    raise exception 'Un journal validé chevauche déjà cette période de validité';
  end if;
  update public.compta_parametre set statut='valide',valide_par=v_uid,updated_at=now()
  where id=v_row.id and pharmacie_id=p_pharmacie;
  perform public.compta_auditer(p_pharmacie,v_uid,'journal_comptable_valide','journal',v_row.id::text,
    'succes','Validation du journal ' || v_row.cle);
  return true;
end $$;

revoke all on function public.compta_plan_enregistrer_mapping(uuid,uuid,text,text,uuid,date,date) from public,anon;
revoke all on function public.compta_plan_valider_mapping(uuid,uuid) from public,anon;
revoke all on function public.compta_config_valider_journal(uuid,uuid) from public,anon;
grant execute on function public.compta_plan_enregistrer_mapping(uuid,uuid,text,text,uuid,date,date) to authenticated;
grant execute on function public.compta_plan_valider_mapping(uuid,uuid) to authenticated;
grant execute on function public.compta_config_valider_journal(uuid,uuid) to authenticated;
commit;
